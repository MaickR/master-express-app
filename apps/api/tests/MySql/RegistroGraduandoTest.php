<?php

namespace Tests\MySql;

use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Monolog\Handler\TestHandler;
use Monolog\Logger;
use PHPUnit\Framework\Attributes\TestWith;
use RuntimeException;
use Symfony\Component\Mailer\Exception\TransportException;

class RegistroGraduandoTest extends CasoMySql
{
    private const string BASE = '/api/registro-graduando/';

    private const string CORREO = 'alta@example.invalid';

    private const string ORIGEN = 'http://127.0.0.1:5173';

    protected array $tablas = [
        'users', 'roles', 'rol_user', 'sessions', 'jobs', 'failed_jobs', 'graduandos', 'registros', 'desafios_de_registro',
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
            'cors.allowed_origins' => [self::ORIGEN],
        ]);
        $this->app->bind(PreventRequestForgery::class, fn ($app) => new class($app, $app['encrypter']) extends PreventRequestForgery
        {
            protected function runningUnitTests(): bool
            {
                return false;
            }
        });
        $this->freezeSecond();
    }

    public function test_alta_verificada_idempotente_con_minimo_privilegio_y_sin_operaciones_comerciales(): void
    {
        $conteos = $this->conteosOperativos();
        $correo = strtoupper(self::CORREO);
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('codigo', ['email' => " $correo "], $sesion)
            ->assertNoContent(202)->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Access-Control-Allow-Origin', self::ORIGEN);
        $this->assertDatabaseMissing('users', ['email' => self::CORREO]);

        $trabajo = json_decode(DB::table('jobs')->where('queue', 'registro-graduando')->sole()->payload, true);
        $this->assertStringNotContainsString(self::CORREO, $trabajo['data']['command']);
        $this->assertSame(64, strlen(DB::table('desafios_de_registro')->sole()->codigo_hmac));
        $codigo = $this->procesarCorreo();

        $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $codigo], $sesion)->assertNoContent();
        $this->assertNull(DB::table('desafios_de_registro')->sole()->codigo_hmac);
        $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $codigo], $sesion)
            ->assertUnprocessable()->assertJsonValidationErrors('codigo');
        $this->enviar('cuenta', $this->datos(['email' => 'otro@example.invalid']), $sesion)
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $otraSesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('cuenta', $this->datos(), $otraSesion)->assertUnprocessable();
        $this->enviar('cuenta', $this->datos(['roles' => ['administrador'], 'activa' => true]), $sesion)
            ->assertUnprocessable()->assertJsonValidationErrors('solicitud');

        $this->enviar('cuenta', $this->datos(), $sesion)->assertNoContent();
        $this->enviar('cuenta', $this->datos(['nombres' => 'Otro']), $sesion)->assertNoContent();
        $usuario = User::query()->where('email', self::CORREO)->sole();
        $this->assertSame(['graduando'], $usuario->roles()->pluck('codigo')->all());
        $this->assertSame([], $usuario->codigosDeAcceso());
        $this->assertSame('María-José D’Ávila', $usuario->name);
        $this->assertSame('000421', $usuario->numero_documento);
        $this->assertSame('+57 (031) 000-1234', $usuario->telefono);
        $this->assertNotNull($usuario->email_verified_at);
        $this->assertTrue(Hash::check($this->datos()['password'], $usuario->password));
        $this->assertArrayNotHasKey('numero_documento', $usuario->toArray());
        $this->assertSame($conteos, $this->conteosOperativos());

        $this->enviar('login', ['email' => self::CORREO, 'password' => $this->datos()['password']], $sesion)
            ->assertUnprocessable();
        $this->getJson('/api/mi-sesion')->assertUnauthorized();
        $this->actingAs($usuario);
        foreach (['/api/registros', '/api/registros/1', '/api/instituciones', '/api/eventos', '/api/eventos/1/ceremonias', '/api/administracion/cuentas'] as $ruta) {
            $this->getJson($ruta)->assertForbidden();
        }
    }

    public function test_reenvio_expiracion_y_limite_de_cinco_intentos(): void
    {
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $entrada = ['email' => self::CORREO];
        $this->enviar('codigo', $entrada, $sesion)->assertNoContent(202);
        $anterior = $this->procesarCorreo();
        $this->travel(59)->seconds();
        $this->enviar('codigo', $entrada, $sesion)->assertTooManyRequests()->assertHeader('Retry-After', '1');
        $this->travel(1)->seconds();
        $this->enviar('codigo', $entrada, $sesion)->assertNoContent(202);
        $actual = $this->procesarCorreo();
        $this->assertTrue(! hash_equals($anterior, $actual));
        $otraSesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('confirmacion', $entrada + ['codigo' => $actual], $otraSesion)->assertUnprocessable();
        for ($i = 0; $i < 5; $i++) {
            $this->enviar('confirmacion', $entrada + ['codigo' => $anterior], $sesion)
                ->assertUnprocessable()->assertJsonValidationErrors('codigo');
        }
        $this->enviar('confirmacion', $entrada + ['codigo' => $actual], $sesion)
            ->assertTooManyRequests()->assertHeader('Retry-After', '600');
        $this->assertSame(5, DB::table('desafios_de_registro')->sole()->intentos);
        $this->travel(600)->seconds();
        $this->enviar('confirmacion', $entrada + ['codigo' => $actual], $sesion)->assertUnprocessable();
    }

    public function test_solicitud_duplicada_es_neutra_y_una_cuenta_creada_en_carrera_conserva_sus_roles(): void
    {
        $interno = User::factory()->create(['email' => 'interno@example.invalid']);
        $interno->roles()->attach(Rol::query()->where('codigo', 'administrador')->sole()->id);
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $duplicado = $this->enviar('codigo', ['email' => $interno->email], $sesion)->assertNoContent(202);
        $nuevo = $this->enviar('codigo', ['email' => self::CORREO], $sesion)->assertNoContent(202);
        $this->assertSame($duplicado->getContent(), $nuevo->getContent());
        $this->assertSame($duplicado->headers->get('Cache-Control'), $nuevo->headers->get('Cache-Control'));
        $this->procesarCorreo(0);
        $codigo = $this->procesarCorreo();
        $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $codigo], $sesion)->assertNoContent();

        $creadoAparte = User::factory()->create(['email' => self::CORREO]);
        $creadoAparte->roles()->attach(Rol::query()->where('codigo', 'colaborador')->sole()->id);
        $this->enviar('cuenta', $this->datos(), $sesion)->assertNoContent();
        $this->assertSame(['colaborador'], $creadoAparte->roles()->pluck('codigo')->all());
        $this->assertSame($creadoAparte->password, $creadoAparte->fresh()->password);
        $this->assertSame(['administrador'], $interno->roles()->pluck('codigo')->all());
    }

    public function test_reenvio_descarta_correo_pendiente_y_la_verificacion_tiene_su_propio_vencimiento(): void
    {
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $entrada = ['email' => self::CORREO];
        $this->enviar('codigo', $entrada, $sesion)->assertNoContent(202);
        $this->travel(60)->seconds();
        $this->enviar('codigo', $entrada, $sesion)->assertNoContent(202);
        $this->procesarCorreo(0);
        $codigo = $this->procesarCorreo();
        $this->travel(599)->seconds();
        $this->enviar('confirmacion', $entrada + ['codigo' => $codigo], $sesion)->assertNoContent();
        $this->travel(600)->seconds();
        $this->enviar('cuenta', $this->datos(), $sesion)->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_codigo_solo_admite_seis_digitos_ascii_en_texto(): void
    {
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        foreach ([' 012345 ', '０１２３４５', 123456, '01234'] as $invalido) {
            $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $invalido], $sesion)
                ->assertUnprocessable()->assertJsonValidationErrors('codigo');
        }
        $this->assertDatabaseCount('desafios_de_registro', 0);
    }

    public function test_exige_csrf_y_limita_por_correo_normalizado_y_por_ip(): void
    {
        foreach (['codigo', 'confirmacion', 'cuenta'] as $paso) {
            $this->postJson(self::BASE.$paso, ['email' => self::CORREO])->assertStatus(419)
                ->assertHeader('Cache-Control', 'no-store, private');
        }
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        for ($i = 0; $i < 3; $i++) {
            $this->enviar('codigo', ['email' => self::CORREO], $sesion)->assertNoContent(202);
            $this->travel(60)->seconds();
        }
        $this->enviar('codigo', ['email' => strtoupper(self::CORREO)], $sesion, '127.0.0.2')
            ->assertTooManyRequests()->assertHeader('Retry-After');
        for ($i = 0; $i < 12; $i++) {
            $this->enviar('codigo', ['email' => "limite$i@example.invalid"], $sesion)->assertNoContent(202);
        }
        $this->enviar('codigo', ['email' => 'adicional@example.invalid'], $sesion)
            ->assertTooManyRequests()->assertHeader('Retry-After');
    }

    #[TestWith(['email', 'sin-arroba', 'email'])]
    #[TestWith(['nombres', 'María2', 'nombres'])]
    #[TestWith(['nombres', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'nombres'])]
    #[TestWith(['telefono', 3101234567, 'telefono'])]
    #[TestWith(['telefono', '123456', 'telefono'])]
    #[TestWith(['tipo_documento', 'pasaporte', 'tipo_documento'])]
    #[TestWith(['tipo_documento', null, 'tipo_documento'])]
    #[TestWith(['numero_documento', null, 'numero_documento'])]
    #[TestWith(['numero_documento', '１２３', 'numero_documento'])]
    #[TestWith(['numero_documento', ' 001 ', 'numero_documento'])]
    #[TestWith(['numero_documento', 123, 'numero_documento'])]
    #[TestWith(['password', 'corta', 'password'])]
    #[TestWith(['password', 'ááááááááááááááááááááááááááááááááááááá', 'password'])]
    #[TestWith(['password', "contraseña\0nula", 'password'])]
    #[TestWith(['password_confirmation', 'No-es-la-misma', 'password_confirmation'])]
    #[TestWith(['fecha_nacimiento', '2000-01-01', 'solicitud'])]
    #[TestWith(['ceremonia_id', 1, 'solicitud'])]
    #[TestWith(['pago', true, 'solicitud'])]
    public function test_reglas_de_entrada(string $campo, mixed $valor, string $error): void
    {
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('cuenta', $this->datos([$campo => $valor]), $sesion)
            ->assertUnprocessable()->assertJsonValidationErrors($error);
    }

    public function test_documento_opcional_y_contrasena_con_formato_bcrypt_se_trata_como_texto(): void
    {
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('codigo', ['email' => self::CORREO], $sesion)->assertNoContent(202);
        $codigo = $this->procesarCorreo();
        $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $codigo], $sesion)->assertNoContent();
        $clave = Hash::make('Clave ficticia interna');
        $datos = $this->datos([
            'nombres' => str_repeat('É', 150), 'apellidos' => str_repeat('ó', 150),
            'password' => $clave, 'password_confirmation' => $clave,
        ]);
        unset($datos['tipo_documento'], $datos['numero_documento']);
        $this->enviar('cuenta', $datos, $sesion)->assertNoContent();
        $usuario = User::query()->where('email', self::CORREO)->sole();
        $this->assertNull($usuario->tipo_documento);
        $this->assertNull($usuario->numero_documento);
        $this->assertSame(301, mb_strlen($usuario->name));
        $this->assertNotSame($clave, $usuario->password);
        $this->assertTrue(Hash::check($clave, $usuario->password));
    }

    public function test_fallo_de_cola_revierte_el_desafio_y_oculta_detalles_aun_con_debug(): void
    {
        $registros = new TestHandler;
        Log::swap(new Logger('registro-qa', [$registros]));
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        config(['app.debug' => true, 'queue.connections.database.connection' => 'conexion-ficticia']);
        $this->enviar('codigo', ['email' => self::CORREO], $sesion)->assertStatus(500)
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertExactJson(['message' => 'El servicio no pudo completar la solicitud.']);
        $this->assertDatabaseCount('desafios_de_registro', 0);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertCount(1, $registros->getRecords());
        $this->assertSame(['tipo' => \LogicException::class], $registros->getRecords()[0]->context);
        config(['queue.connections.database.connection' => 'mysql_pruebas']);
        $this->enviar('codigo', ['email' => self::CORREO], $sesion)->assertNoContent(202);
    }

    public function test_el_fallo_del_transporte_no_persiste_el_codigo_ni_el_destinatario_en_la_excepcion(): void
    {
        $registros = new TestHandler;
        Log::swap(new Logger('registro-qa', [$registros]));
        config(['queue.failed.driver' => 'database-uuids', 'queue.failed.database' => 'mysql_pruebas']);
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('codigo', ['email' => self::CORREO], $sesion)->assertNoContent(202);

        $mailer = Mail::mailer();
        Mail::partialMock()->shouldReceive('mailer')->andReturn($mailer);
        Mail::shouldReceive('raw')->once()->andReturnUsing(function (string $cuerpo): never {
            throw new TransportException($cuerpo.' '.self::CORREO);
        });
        $this->assertSame(0, Artisan::call('queue:work', ['connection' => 'database', '--queue' => 'registro-graduando', '--once' => true]));
        $fallo = DB::table('failed_jobs')->where('queue', 'registro-graduando')->sole();
        $this->assertTrue(str_contains($fallo->exception, 'No se pudo procesar el correo de registro.'));
        $this->assertFalse(str_contains($fallo->exception, self::CORREO));
        $this->assertFalse(str_contains($fallo->exception, 'Tu código de registro'));
        $this->assertFalse(str_contains($fallo->payload, self::CORREO));
        $this->assertTrue($registros->hasErrorRecords());
        $this->assertFalse(str_contains($registros->getRecords()[0]->message, 'Tu código de registro'));
    }

    public function test_fallo_al_guardar_permite_reintentar_con_la_verificacion_original(): void
    {
        Log::swap(new Logger('registro-qa', [new TestHandler]));
        $sesion = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->enviar('codigo', ['email' => self::CORREO], $sesion)->assertNoContent(202);
        $codigo = $this->procesarCorreo();
        $this->enviar('confirmacion', ['email' => self::CORREO, 'codigo' => $codigo], $sesion)->assertNoContent();
        $fallar = true;
        DB::connection()->beforeExecuting(function (string $sql) use (&$fallar): void {
            if ($fallar && str_starts_with($sql, 'insert into `rol_user`')) {
                throw new RuntimeException('Detalle ficticio que no debe salir del servidor.');
            }
        });
        $this->enviar('cuenta', $this->datos(), $sesion)->assertStatus(500)
            ->assertExactJson(['message' => 'El servicio no pudo completar la solicitud.']);
        $this->assertDatabaseMissing('users', ['email' => self::CORREO]);
        $this->assertDatabaseHas('desafios_de_registro', ['estado' => 'verificado']);
        $fallar = false;
        $this->enviar('cuenta', $this->datos(), $sesion)->assertNoContent();
    }

    private function datos(array $reemplazos = []): array
    {
        return $reemplazos + [
            'email' => self::CORREO,
            'nombres' => 'María-José',
            'apellidos' => 'D’Ávila',
            'telefono' => '+57 (031) 000-1234',
            'tipo_documento' => 'tarjeta_identidad',
            'numero_documento' => '000421',
            'password' => 'Clave ficticia de QA',
            'password_confirmation' => 'Clave ficticia de QA',
        ];
    }

    private function conteosOperativos(): array
    {
        return array_map(fn ($tabla) => DB::table($tabla)->count(), ['graduandos', 'registros', 'instituciones', 'eventos', 'ceremonias']);
    }

    private function enviar(string $paso, array $datos, TestResponse $sesion, string $ip = '127.0.0.1'): TestResponse
    {
        Auth::forgetGuards();
        $ruta = $paso === 'login' ? '/login' : self::BASE.$paso;
        $cookie = config('session.cookie');

        return $this->call('POST', $ruta, [], [$cookie => $sesion->getCookie($cookie, false)->getValue()], [], [
            'HTTP_ORIGIN' => self::ORIGEN,
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_XSRF_TOKEN' => $sesion->getCookie('XSRF-TOKEN', false)->getValue(),
            'REMOTE_ADDR' => $ip,
        ], json_encode($datos, JSON_THROW_ON_ERROR));
    }

    private function procesarCorreo(int $esperados = 1): ?string
    {
        $transporte = Mail::mailer()->getSymfonyTransport();
        $transporte->flush();
        $this->assertSame(0, Artisan::call('queue:work', ['connection' => 'database', '--queue' => 'registro-graduando', '--once' => true]));
        $mensajes = $transporte->messages();
        $this->assertCount($esperados, $mensajes);
        if ($esperados === 0) {
            return null;
        }
        $mensaje = $mensajes->sole()->getOriginalMessage();
        $this->assertSame(self::CORREO, $mensaje->getTo()[0]->getAddress());
        $this->assertSame(1, preg_match('/\b[0-9]{6}\b/', $mensaje->getTextBody(), $codigo));

        return $codigo[0];
    }
}
