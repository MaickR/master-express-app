<?php

namespace Tests\MySql;

use App\Models\Institucion;
use App\Models\Rol;
use App\Models\SolicitudInstitucional;
use App\Models\User;
use App\Models\VinculoInstitucional;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\TestWith;
use RuntimeException;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mime\Email;

class RegistroInstitucionTest extends CasoMySql
{
    private const string BASE = '/api/registro-institucion/';

    private const string ADMIN = '/api/administracion/solicitudes-institucionales';

    private const string CORREO = 'rectoria@example.invalid';

    private const string CLAVE = 'Clave ficticia de QA';

    private const string ORIGEN = 'http://127.0.0.1:5173';

    protected array $tablas = [
        'users', 'roles', 'rol_user', 'sessions', 'password_reset_tokens', 'jobs', 'failed_jobs',
        'instituciones', 'sedes', 'solicitudes_institucionales', 'vinculos_institucionales', 'desafios_de_registro',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.key' => 'base64:'.base64_encode(random_bytes(32)),
            'session.driver' => 'database',
            'session.connection' => 'mysql_pruebas',
            'session.secure' => false,
            'session.domain' => null,
            'cache.limiter' => 'array',
            'queue.connections.database.connection' => 'mysql_pruebas',
            'queue.failed.driver' => 'database-uuids',
            'queue.failed.database' => 'mysql_pruebas',
            'cors.allowed_origins' => [self::ORIGEN],
            'sanctum.stateful' => ['127.0.0.1:5173', '127.0.0.1:8000'],
        ]);
        $this->app->bind(PreventRequestForgery::class, fn ($app) => new class($app, $app['encrypter']) extends PreventRequestForgery
        {
            protected function runningUnitTests(): bool
            {
                return false;
            }
        });
    }

    public function test_solicitud_nueva_queda_pendiente_hasta_aprobar_y_activar(): void
    {
        $antes = Institucion::query()->count();
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('codigo', ['email' => ' '.strtoupper(self::CORREO).' '], $sesion)->assertNoContent(202);
        $codigo = $this->procesarCodigo();
        $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $codigo], $sesion)->assertNoContent();
        $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $codigo], $sesion)->assertUnprocessable();

        $creada = $this->enviar('solicitud', $this->datos(['roles' => ['administrador']]), $sesion)
            ->assertUnprocessable()->assertJsonValidationErrors('solicitud');
        $this->assertSame(0, $creada->json('data.id') ?? 0);
        $alta = $this->enviar('solicitud', $this->datos(), $sesion)->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private');
        $id = $alta->json('data.id');
        $this->enviar('solicitud', $this->datos(), $sesion)->assertCreated()->assertJsonPath('data.id', $id);
        $this->assertSame(1, SolicitudInstitucional::query()->count());
        $this->assertDatabaseMissing('users', ['email' => self::CORREO]);
        $this->assertSame($antes, Institucion::query()->count());
        $this->assertSame('0900123456-7', SolicitudInstitucional::query()->find($id)->nit);

        $admin = $this->ingresar($this->cuenta(['administrador'], 'admin.institucion@example.invalid'));
        $this->llamar('GET', self::ADMIN, [], $admin)->assertOk()->assertJsonPath('data.0.id', $id);
        $decision = $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $admin)->assertOk();
        $this->assertSame('aprobada', $decision->json('data.estado'));
        $institucionId = $decision->json('data.institucion_id');
        $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $admin)->assertConflict();
        $this->llamar('POST', self::ADMIN.'/'.$id.'/rechazo', ['motivo' => 'Motivo que ya no procede'], $admin)->assertConflict();
        $this->assertSame($antes + 1, Institucion::query()->count());
        $this->assertSame('0900123456-7', Institucion::query()->find($institucionId)->nit);
        $this->assertSame(1, VinculoInstitucional::query()->where('estado', 'pendiente_activacion')->count());

        $mensaje = $this->procesarDecision();
        $this->assertSame('Tu solicitud institucional fue aprobada', $mensaje->getSubject());
        $this->assertStringContainsString('Colegio', $mensaje->getTextBody());
        $this->assertStringContainsString('Activar mi acceso', $mensaje->getHtmlBody());
        $this->assertSame(1, preg_match('/activar-institucion#([^\\s]+)/', $mensaje->getTextBody(), $enlace));
        parse_str(html_entity_decode($enlace[1]), $parametros);
        $usuario = User::query()->where('email', self::CORREO)->sole();
        $this->assertSame([], $usuario->roles()->pluck('codigo')->all());
        $this->enviar('login', ['email' => self::CORREO, 'password' => self::CLAVE], $sesion)->assertUnprocessable();

        $this->enviar('activacion', [
            'email' => self::CORREO, 'token' => $parametros['token'],
            'password' => self::CLAVE, 'password_confirmation' => self::CLAVE, 'roles' => ['administrador'],
        ], $sesion)->assertUnprocessable()->assertJsonValidationErrors('solicitud');
        $this->enviar('activacion', [
            'email' => self::CORREO, 'token' => $parametros['token'],
            'password' => self::CLAVE, 'password_confirmation' => self::CLAVE,
        ], $sesion)->assertNoContent();
        $this->enviar('activacion', [
            'email' => self::CORREO, 'token' => $parametros['token'],
            'password' => self::CLAVE, 'password_confirmation' => self::CLAVE,
        ], $sesion)->assertUnprocessable()->assertJsonValidationErrors('token');

        $usuario->refresh();
        $this->assertSame(['institucion'], $usuario->roles()->pluck('codigo')->all());
        $this->assertTrue($usuario->operaEnInstitucion($institucionId));
        $this->assertFalse($usuario->operaEnInstitucion($institucionId + 1));
        $this->assertNotNull($usuario->email_verified_at);
        $ingreso = $this->enviar('login', ['email' => self::CORREO, 'password' => self::CLAVE], $this->sesionNueva())->assertNoContent();
        $this->llamar('GET', '/api/mi-sesion', [], $ingreso)->assertOk()->assertJsonPath('data.roles', ['institucion']);
        foreach (['/api/registros', '/api/instituciones', '/api/eventos', '/api/eventos/1/ceremonias', '/api/administracion/cuentas', self::ADMIN] as $ruta) {
            $this->llamar('GET', $ruta, [], $ingreso)->assertForbidden();
        }
        $this->llamar('POST', '/api/eventos', ['institucion_id' => $institucionId], $ingreso)->assertForbidden();
        $this->llamar('POST', '/api/registro-graduando/codigo', ['email' => self::CORREO], $this->sesionNueva())->assertNoContent(202);
        $transporte = Mail::mailer()->getSymfonyTransport();
        $transporte->flush();
        $this->assertSame(0, Artisan::call('queue:work', [
            'connection' => 'database', '--queue' => 'registro-graduando', '--once' => true,
        ]));
        $this->assertCount(0, $transporte->messages());
        $this->assertSame(1, User::query()->where('email', self::CORREO)->count());
        $this->assertSame(['institucion'], $usuario->refresh()->codigosDeSesion());
    }

    #[TestWith([['graduando'], ['graduando', 'institucion']])]
    #[TestWith([['colaborador', 'graduando'], ['colaborador']])]
    public function test_cuenta_verificada_solicita_sin_duplicar_usuario_ni_roles(array $rolesOriginales, array $rolesDeSesion): void
    {
        $correo = 'existente@example.invalid';
        $titular = $rolesOriginales === ['graduando']
            ? $this->registrarGraduando($correo)
            : $this->cuenta($rolesOriginales, $correo);
        $claveOriginal = $titular->password;
        $sesionPublica = $this->sesionNueva();
        $this->enviar('codigo', ['email' => $titular->email], $sesionPublica)
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('jobs', 0);
        $this->enviar('representacion', $this->datos(), $sesionPublica)->assertUnauthorized();
        $sinVerificar = $this->cuenta(['colaborador'], 'noverificado@example.invalid', false);
        $this->llamar('POST', self::BASE.'representacion', $this->sinCorreo(), $this->ingresar($sinVerificar))->assertForbidden();

        $sesion = $this->ingresar($titular);
        $this->llamar('GET', '/api/mi-sesion', [], $sesion)->assertOk()
            ->assertJsonPath('data.id', $titular->id)
            ->assertJsonPath('data.roles', $rolesOriginales === ['graduando'] ? ['graduando'] : ['colaborador']);
        $this->llamar('POST', self::BASE.'representacion', $this->datos(['email' => $titular->email, 'user_id' => $titular->id]), $sesion)
            ->assertUnprocessable()->assertJsonValidationErrors('solicitud');
        $alta = $this->llamar('POST', self::BASE.'representacion', $this->sinCorreo([
            'tipo' => 'universidad', 'nit' => '800100200-3',
        ]), $sesion)->assertCreated();
        $id = $alta->json('data.id');
        $this->llamar('POST', self::BASE.'representacion', $this->sinCorreo([
            'tipo' => 'universidad', 'nit' => '800100200-3',
        ]), $sesion)->assertCreated()->assertJsonPath('data.id', $id);
        $this->assertSame(1, User::query()->where('email', $titular->email)->count());
        $this->assertEqualsCanonicalizing($rolesOriginales, $titular->roles()->pluck('codigo')->all());
        $this->llamar('GET', '/api/mi-institucion', [], $sesion)->assertForbidden();

        $admin = $this->ingresar($this->cuenta(['administrador'], 'admin.existente@example.invalid'));
        $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $admin)->assertOk()
            ->assertJsonPath('data.requiere_activacion', false);
        $mensaje = $this->procesarDecision();
        $this->assertStringNotContainsString('activar-institucion', $mensaje->getTextBody());
        $this->assertStringContainsString('Ya puedes ingresar', $mensaje->getTextBody());
        $titular->refresh();
        $this->assertEqualsCanonicalizing([...$rolesOriginales, 'institucion'], $titular->roles()->pluck('codigo')->all());
        $this->assertSame($claveOriginal, $titular->password);
        $this->llamar('GET', '/api/mi-sesion', [], $sesion)->assertOk()
            ->assertJsonPath('data.id', $titular->id)->assertJsonPath('data.roles', $rolesDeSesion);
        $vinculo = VinculoInstitucional::query()->where('user_id', $titular->id)
            ->where('estado', VinculoInstitucional::ACTIVO)->sole();
        $this->llamar('GET', '/api/mi-institucion', [], $sesion)->assertOk()
            ->assertJsonPath('data.0.institucion_id', $vinculo->institucion_id)
            ->assertJsonPath('data.0.sede.id', $vinculo->sede_id);
        if ($rolesOriginales === ['graduando']) {
            $nuevoIngreso = $this->ingresar($titular);
            $this->llamar('GET', '/api/mi-sesion', [], $nuevoIngreso)->assertOk()
                ->assertJsonPath('data.id', $titular->id)->assertJsonPath('data.roles', $rolesDeSesion);
            $this->llamar('GET', '/api/administracion/cuentas', [], $nuevoIngreso)->assertForbidden();
            $this->llamar('POST', '/api/eventos', [], $nuevoIngreso)->assertForbidden();
        }

        $vinculo->forceFill(['estado' => VinculoInstitucional::PENDIENTE])->save();
        $this->llamar('GET', '/api/mi-institucion', [], $sesion)->assertForbidden();
    }

    public function test_rechazo_exige_motivo_y_no_concede_acceso(): void
    {
        $id = $this->solicitudLista('universidad', '900555000-1', 'rechazo@example.invalid');
        $admin = $this->ingresar($this->cuenta(['administrador'], 'admin.rechazo@example.invalid'));
        $this->llamar('POST', self::ADMIN.'/'.$id.'/rechazo', [], $admin)->assertUnprocessable()->assertJsonValidationErrors('motivo');
        $this->llamar('POST', self::ADMIN.'/'.$id.'/rechazo', ['motivo' => 'corto'], $admin)->assertUnprocessable();
        $motivo = 'La documentación de la sede no permite verificar la representación.';
        $this->llamar('POST', self::ADMIN.'/'.$id.'/rechazo', ['motivo' => $motivo], $admin)->assertOk()
            ->assertJsonPath('data.estado', 'rechazada');
        $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $admin)->assertConflict();
        $this->assertDatabaseMissing('users', ['email' => 'rechazo@example.invalid']);
        $this->assertSame(0, VinculoInstitucional::query()->count());
        $mensaje = $this->procesarDecision();
        $this->assertSame('Tu solicitud institucional no fue aprobada', $mensaje->getSubject());
        $this->assertStringContainsString($motivo, $mensaje->getHtmlBody());
        $this->assertStringContainsString($motivo, $mensaje->getTextBody());
        $historial = $this->llamar('GET', self::ADMIN.'/decisiones', [], $admin)->assertOk();
        $this->assertSame($motivo, $historial->json('data.0.motivo'));
        $this->assertSame(
            User::query()->where('email', 'admin.rechazo@example.invalid')->value('id'),
            $historial->json('data.0.administrador.id'),
        );
    }

    public function test_fallo_de_correo_conserva_la_decision_y_el_reintento_no_duplica(): void
    {
        $id = $this->solicitudLista('colegio', '901000111-2', 'fallo@example.invalid');
        $admin = $this->ingresar($this->cuenta(['administrador'], 'admin.fallo@example.invalid'));
        $mailer = Mail::mailer();
        Mail::partialMock()->shouldReceive('mailer')->andReturn($mailer);
        Mail::shouldReceive('send')->once()->andReturnUsing(function (): never {
            throw new TransportException('SECRETO-QA token-privado fallo@example.invalid');
        });
        $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $admin)->assertOk();
        $this->assertSame(0, Artisan::call('queue:work', [
            'connection' => 'database', '--queue' => 'registro-institucion', '--once' => true,
        ]));
        $solicitud = SolicitudInstitucional::query()->find($id);
        $this->assertSame('aprobada', $solicitud->estado);
        $this->assertSame('fallida', $solicitud->notificacion_estado);
        $this->assertSame(SolicitudInstitucional::FALLO_ENTREGA, $solicitud->notificacion_detalle);
        $this->assertSame(1, Institucion::query()->where('nit', '901000111-2')->count());
        $fallo = DB::table('failed_jobs')->where('queue', 'registro-institucion')->sole();
        $this->assertStringContainsString(SolicitudInstitucional::FALLO_ENTREGA, $fallo->exception);
        $this->assertStringNotContainsString('SECRETO-QA', $fallo->exception);
        $this->assertStringNotContainsString('fallo@example.invalid', $fallo->exception);
        $this->assertStringNotContainsString('fallo@example.invalid', $fallo->payload);

        $this->app->forgetInstance('mail.manager');
        Mail::clearResolvedInstances();
        $this->llamar('POST', self::ADMIN.'/'.$id.'/notificacion', [], $admin)->assertNoContent(202);
        $reenvio = $this->procesarDecision();
        $this->assertStringContainsString('901000111-2', Institucion::query()->where('nit', '901000111-2')->sole()->nit);
        $this->assertSame('enviada', $solicitud->refresh()->notificacion_estado);
        $this->assertSame('Tu solicitud institucional fue aprobada', $reenvio->getSubject());
        $this->assertSame(1, Institucion::query()->where('nit', '901000111-2')->count());
        $this->assertSame(1, VinculoInstitucional::query()->count());
        $this->llamar('POST', self::ADMIN.'/'.$id.'/notificacion', [], $admin)->assertConflict();
        $this->assertSame(0, DB::table('jobs')->count());
    }

    public function test_no_vincula_por_nit_nombre_o_dominio_y_bloquea_el_nit_repetido(): void
    {
        Institucion::query()->forceCreate([
            'nombre' => 'Colegio San José', 'tipo' => 'colegio', 'nit' => '860000111-9',
        ]);
        $id = $this->solicitudLista('colegio', '860000111-9', 'repetido@example.invalid');
        $admin = $this->ingresar($this->cuenta(['administrador'], 'admin.nit@example.invalid'));
        $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $admin)
            ->assertConflict();
        $this->assertSame('pendiente', SolicitudInstitucional::query()->find($id)->estado);
        $this->assertSame(1, Institucion::query()->where('nit', '860000111-9')->count());
        $this->assertDatabaseMissing('users', ['email' => 'repetido@example.invalid']);

        $primera = $this->solicitudLista('universidad', '700100200-1', 'una.colegio@example.invalid');
        $segunda = $this->solicitudLista('universidad', '700100200-2', 'otra.colegio@example.invalid');
        $this->llamar('POST', self::ADMIN.'/'.$primera.'/aprobacion', [], $admin)->assertOk();
        $this->llamar('POST', self::ADMIN.'/'.$segunda.'/aprobacion', [], $admin)->assertOk();
        $this->assertSame(2, Institucion::query()->where('nombre', 'Colegio San José')->whereIn('nit', ['700100200-1', '700100200-2'])->count());
        $this->procesarDecision();
        $this->procesarDecision();
    }

    public function test_otros_roles_no_deciden_y_el_otp_se_reutiliza(): void
    {
        $id = $this->solicitudLista('colegio', '123456789-0', 'otp@example.invalid');
        $this->llamar('GET', self::ADMIN)->assertUnauthorized();
        foreach (['colaborador', 'graduando'] as $rol) {
            $sesion = $this->ingresar($this->cuenta([$rol], $rol.'.decision@example.invalid'));
            $this->llamar('GET', self::ADMIN, [], $sesion)->assertForbidden();
            $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $sesion)->assertForbidden();
            $this->llamar('GET', self::ADMIN.'/'.$id, [], $sesion)->assertForbidden();
        }
        $vendedor = $this->cuenta(['vendedor'], 'vendedor.decision@example.invalid');
        $this->enviar('login', ['email' => $vendedor->email, 'password' => self::CLAVE], $this->sesionNueva())->assertUnprocessable();

        $sesion = $this->sesionNueva();
        $this->freezeSecond();
        $this->enviar('codigo', ['email' => 'reenvio@example.invalid'], $sesion)->assertNoContent(202);
        $this->procesarCodigo('reenvio@example.invalid');
        $this->travel(59)->seconds();
        $this->enviar('codigo', ['email' => 'reenvio@example.invalid'], $sesion)->assertTooManyRequests()->assertHeader('Retry-After', '1');
        $this->travel(1)->seconds();
        $this->enviar('codigo', ['email' => 'reenvio@example.invalid'], $sesion)->assertNoContent(202);
        $codigo = $this->procesarCodigo('reenvio@example.invalid');
        $falso = $codigo === '000000' ? '111111' : '000000';
        for ($intento = 0; $intento < 5; $intento++) {
            $this->enviar('confirmacion', ['email' => 'reenvio@example.invalid', 'codigo' => $falso], $sesion)
                ->assertUnprocessable();
        }
        $this->enviar('confirmacion', ['email' => 'reenvio@example.invalid', 'codigo' => $codigo], $sesion)
            ->assertTooManyRequests();
    }

    public function test_la_cola_mal_configurada_no_revierte_una_decision_ya_confirmada(): void
    {
        $id = $this->solicitudLista('colegio', '555000111-4', 'cola@example.invalid');
        $admin = $this->ingresar($this->cuenta(['administrador'], 'admin.cola@example.invalid'));
        Bus::partialMock()->shouldReceive('dispatch')->once()->andThrow(new RuntimeException('cola ficticia'));
        $this->llamar('POST', self::ADMIN.'/'.$id.'/aprobacion', [], $admin)->assertOk()
            ->assertJsonPath('data.notificacion.estado', 'pendiente');
        $this->assertSame('aprobada', SolicitudInstitucional::query()->find($id)->estado);
        $this->assertSame(1, Institucion::query()->where('nit', '555000111-4')->count());
        $this->assertDatabaseCount('jobs', 0);
    }

    #[TestWith(['nit', '900-123-1'])]
    #[TestWith(['nit', '900123456-'])]
    #[TestWith(['nit', 'ABC-1'])]
    #[TestWith(['nit', 900123456])]
    #[TestWith(['tipo', 'Colegio'])]
    #[TestWith(['tipo', 'instituto'])]
    #[TestWith(['representante', '123'])]
    #[TestWith(['telefono', '123'])]
    #[TestWith(['razon_social', ''])]
    #[TestWith(['sede', '***'])]
    #[TestWith(['email', 'no-es-correo'])]
    public function test_reglas_de_entrada(string $campo, mixed $valor): void
    {
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('solicitud', $this->datos([$campo => $valor]), $sesion)->assertUnprocessable();
    }

    private function registrarGraduando(string $correo): User
    {
        $ruta = '/api/registro-graduando/';
        $sesion = $this->sesionNueva();
        $this->llamar('POST', $ruta.'codigo', ['email' => $correo], $sesion)->assertNoContent(202);
        $codigo = $this->procesarCodigo($correo, 'registro-graduando');
        $this->llamar('POST', $ruta.'confirmacion', ['email' => $correo, 'codigo' => $codigo], $sesion)->assertNoContent();
        $this->llamar('POST', $ruta.'cuenta', [
            'email' => $correo, 'nombres' => 'Daniela', 'apellidos' => 'Rincón',
            'telefono' => '3000000000', 'password' => self::CLAVE, 'password_confirmation' => self::CLAVE,
        ], $sesion)->assertNoContent();

        return User::query()->where('email', $correo)->sole();
    }

    private function solicitudLista(string $tipo, string $nit, string $correo): int
    {
        $sesion = $this->sesionNueva();
        $this->enviar('codigo', ['email' => $correo], $sesion)->assertNoContent(202);
        $codigo = $this->procesarCodigo($correo);
        $this->enviar('confirmacion', ['email' => $correo, 'codigo' => $codigo], $sesion)->assertNoContent();
        $alta = $this->enviar('solicitud', $this->datos([
            'tipo' => $tipo, 'nit' => $nit, 'email' => $correo,
        ]), $sesion)->assertCreated();

        return $alta->json('data.id');
    }

    private function sinCorreo(array $reemplazos = []): array
    {
        $datos = $this->datos($reemplazos);
        unset($datos['email']);

        return $datos;
    }

    private function datos(array $reemplazos = []): array
    {
        return $reemplazos + [
            'tipo' => 'colegio',
            'razon_social' => 'Colegio San José',
            'nit' => '0900123456-7',
            'sede' => 'Sede Norte',
            'representante' => 'María-José D’Ávila',
            'email' => self::CORREO,
            'telefono' => '+57 (601) 555-0100',
        ];
    }

    private function cuenta(array $roles, string $correo, bool $verificado = true): User
    {
        $usuario = User::factory()->create([
            'name' => 'Persona ficticia',
            'email' => $correo,
            'password' => self::CLAVE,
            'email_verified_at' => $verificado ? now() : null,
        ]);
        $usuario->roles()->attach(Rol::query()->whereIn('codigo', $roles)->pluck('id'));

        return $usuario->refresh();
    }

    private function sesionNueva(): TestResponse
    {
        $this->reiniciarPeticion();

        return $this->call('GET', 'http://127.0.0.1:8000/sanctum/csrf-cookie', [], [], [], [
            'HTTP_ORIGIN' => self::ORIGEN,
            'HTTP_ACCEPT' => 'application/json',
        ])->assertNoContent();
    }

    private function ingresar(User $usuario): TestResponse
    {
        $csrf = $this->sesionNueva();
        $respuesta = $this->enviar('login', ['email' => $usuario->email, 'password' => self::CLAVE], $csrf);
        $respuesta->assertNoContent();

        return $respuesta;
    }

    private function enviar(string $paso, array $datos, TestResponse $sesion, string $ip = '127.0.0.1'): TestResponse
    {
        $ruta = match ($paso) {
            'login' => '/login',
            'activacion' => self::BASE.'activacion',
            default => self::BASE.$paso,
        };

        return $this->llamar('POST', $ruta, $datos, $sesion, $ip);
    }

    private function reiniciarPeticion(): void
    {
        Auth::forgetGuards();
        $this->app->forgetInstance('auth.driver');
        $this->app['session']->forgetDrivers();
        $this->app->forgetInstance('session.store');
        $this->app['cookie']->flushQueuedCookies();
    }

    private function llamar(string $metodo, string $ruta, array $datos = [], ?TestResponse $sesion = null, string $ip = '127.0.0.1'): TestResponse
    {
        $this->reiniciarPeticion();
        $cookies = [];
        $servidor = [
            'HTTP_ORIGIN' => self::ORIGEN,
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
            'REMOTE_ADDR' => $ip,
        ];
        if ($sesion) {
            $cookie = config('session.cookie');
            $cookies[$cookie] = $sesion->getCookie($cookie, false)->getValue();
            $servidor['HTTP_X_XSRF_TOKEN'] = $sesion->getCookie('XSRF-TOKEN', false)->getValue();
        }

        return $this->call($metodo, 'http://127.0.0.1:8000'.$ruta, [], $cookies, [], $servidor, $datos === [] && $metodo === 'GET'
            ? null : json_encode($datos, JSON_THROW_ON_ERROR));
    }

    private function procesarCodigo(string $correo = self::CORREO, string $cola = 'registro-institucion'): string
    {
        $transporte = Mail::mailer()->getSymfonyTransport();
        $transporte->flush();
        $this->assertSame(0, Artisan::call('queue:work', [
            'connection' => 'database', '--queue' => $cola, '--once' => true,
        ]));
        $mensajes = $transporte->messages();
        $this->assertCount(1, $mensajes, Artisan::output().' jobs='.DB::table('jobs')->count().' failed='.DB::table('failed_jobs')->count());
        $mensaje = $mensajes->sole()->getOriginalMessage();
        $this->assertSame($correo, $mensaje->getTo()[0]->getAddress());
        $this->assertSame('Tu código de verificación | MasterExpress', $mensaje->getSubject());
        $this->assertSame(1, preg_match('/\b[0-9]{6}\b/', $mensaje->getTextBody(), $codigo));

        return $codigo[0];
    }

    private function procesarDecision(): Email
    {
        $transporte = Mail::mailer()->getSymfonyTransport();
        $transporte->flush();
        $this->assertSame(0, Artisan::call('queue:work', [
            'connection' => 'database', '--queue' => 'registro-institucion', '--once' => true,
        ]));

        return $transporte->messages()->sole()->getOriginalMessage();
    }
}
