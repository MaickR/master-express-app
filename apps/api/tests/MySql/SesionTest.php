<?php

namespace Tests\MySql;

use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Bootstrap\SetRequestForConsole;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Log\Logger as LoggerLaravel;
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
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;

class SesionTest extends CasoMySql
{
    private const string ORIGEN_WEB = 'http://127.0.0.1:5173';

    private const string ORIGEN_API = 'http://127.0.0.1:8000';

    private const string CUENTAS = '/api/administracion/cuentas';

    protected array $tablas = ['users', 'roles', 'rol_user', 'sessions', 'password_reset_tokens', 'jobs', 'failed_jobs', 'eventos_de_cuenta'];

    private string $clave;

    protected function setUp(): void
    {
        parent::setUp();

        $this->clave = bin2hex(random_bytes(16));
        config([
            'app.key' => 'base64:'.base64_encode(random_bytes(32)),
            'session.driver' => 'database',
            'session.connection' => 'mysql_pruebas',
            'session.secure' => false,
            'session.domain' => null,
            'cors.allowed_origins' => [self::ORIGEN_WEB],
            'sanctum.stateful' => ['127.0.0.1:5173', '127.0.0.1:8000'],
            'auth.cola_recuperacion' => 'sync',
        ]);

        $this->app->bind(PreventRequestForgery::class, function ($app) {
            // Ejecute la comprobación real de CSRF que Laravel omite bajo PHPUnit.
            return new class($app, $app['encrypter']) extends PreventRequestForgery
            {
                protected function runningUnitTests(): bool
                {
                    return false;
                }
            };
        });
    }

    public function test_login_identidad_rol_exclusivo_del_servidor_y_logout_con_rotacion(): void
    {
        $usuario = $this->crearUsuario(['colaborador', 'institucion']);
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie')->assertNoContent();
        $csrf->assertHeader('Access-Control-Allow-Origin', self::ORIGEN_WEB)
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
        $cookie = $csrf->getCookie(config('session.cookie'));
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('lax', $cookie->getSameSite());
        $this->assertEmpty($cookie->getDomain());
        $this->assertFalse($csrf->getCookie('XSRF-TOKEN')->isHttpOnly());

        $login = $this->solicitar('POST', '/login', [
            'email' => strtoupper($usuario->email),
            'password' => $this->clave,
            'roles' => ['administrador'],
            'remember' => false,
        ], $csrf)->assertNoContent();
        $sesion = $login->getCookie(config('session.cookie'))->getValue();
        $this->assertNotSame($cookie->getValue(), $sesion);
        $this->assertDatabaseMissing('sessions', ['id' => $cookie->getValue()]);
        $this->assertDatabaseHas('sessions', ['id' => $sesion, 'user_id' => $usuario->id]);
        $this->assertCount(2, $login->headers->getCookies());
        $this->assertSame(0, $login->getCookie(config('session.cookie'))->getExpiresTime());

        $this->solicitar('GET', '/api/mi-sesion?roles[]=administrador', [], $login)
            ->assertOk()->assertExactJson(['data' => [
                'id' => $usuario->id,
                'nombre' => $usuario->name,
                'correo' => $usuario->email,
                'roles' => ['colaborador'],
            ]]);
        $this->solicitar('POST', '/logout', [], $login, enviarCsrf: false)->assertStatus(419);
        $logout = $this->solicitar('POST', '/logout', [], $login)->assertNoContent();
        $this->assertNotSame($sesion, $logout->getCookie(config('session.cookie'))->getValue());
        $this->assertNotSame($login->getCookie('XSRF-TOKEN')->getValue(), $logout->getCookie('XSRF-TOKEN')->getValue());
        $this->assertDatabaseMissing('sessions', ['id' => $sesion]);
        $this->solicitar('GET', '/api/mi-sesion', [], $logout)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', [], $login)->assertUnauthorized();
    }

    public function test_rechazos_de_credenciales_son_indistinguibles(): void
    {
        $admin = $this->crearUsuario(['administrador']);
        $institucion = $this->crearUsuario(['institucion']);
        $sinRoles = $this->crearUsuario([]);
        $vendedor = $this->crearUsuario(['vendedor']);
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');

        foreach ([
            [$admin->email, 'clave-incorrecta'],
            ['inexistente@example.invalid', $this->clave],
            [$institucion->email, $this->clave],
            [$sinRoles->email, $this->clave],
            [$vendedor->email, $this->clave],
        ] as [$correo, $clave]) {
            $this->solicitar('POST', '/login', [
                'email' => $correo, 'password' => $clave, 'roles' => ['administrador'],
            ], $csrf)->assertUnprocessable()->assertExactJson([
                'message' => 'Las credenciales no permiten iniciar sesión.',
                'errors' => ['email' => ['Las credenciales no permiten iniciar sesión.']],
            ]);
        }

        $this->solicitar('GET', '/api/mi-sesion', [], $csrf)->assertUnauthorized();
    }

    public function test_varios_roles_y_cambios_durante_una_sesion(): void
    {
        $usuario = $this->crearUsuario(['administrador', 'colaborador']);
        $login = $this->ingresar($usuario);
        $this->solicitar('GET', '/api/mi-sesion', [], $login)->assertOk()
            ->assertJsonPath('data.roles', ['administrador', 'colaborador']);

        $usuario->roles()->detach(Rol::query()->where('codigo', 'administrador')->sole()->id);
        $this->solicitar('GET', '/api/mi-sesion', [], $login)->assertOk()
            ->assertJsonPath('data.roles', ['colaborador']);

        $usuario->roles()->detach();
        $this->solicitar('GET', '/api/mi-sesion', [], $login)->assertForbidden();
        $this->solicitar('GET', '/api/mi-sesion', [], $login)->assertUnauthorized();
    }

    public function test_sesion_anonima_y_csrf_obligatorio_en_el_flujo_entre_puertos(): void
    {
        $usuario = $this->crearUsuario(['administrador']);
        $this->solicitar('GET', '/api/mi-sesion')->assertUnauthorized();
        $this->solicitar('POST', '/login', ['email' => $usuario->email, 'password' => $this->clave])
            ->assertStatus(419)->assertJsonStructure(['message']);
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');
        $this->solicitar('POST', '/logout', [], $csrf)->assertUnauthorized();
    }

    public function test_limite_de_intentos_normaliza_el_correo(): void
    {
        $usuario = $this->crearUsuario(['administrador']);
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');

        for ($intento = 0; $intento < 5; $intento++) {
            $this->solicitar('POST', '/login', ['email' => $usuario->email, 'password' => 'incorrecta'], $csrf)
                ->assertUnprocessable();
        }

        $this->solicitar('POST', '/login', ['email' => strtoupper($usuario->email), 'password' => $this->clave], $csrf)
            ->assertTooManyRequests()->assertHeader('Retry-After')->assertJsonStructure(['message']);
    }

    public function test_cors_y_sesion_solo_para_el_host_y_puerto_configurados(): void
    {
        $login = $this->ingresar($this->crearUsuario(['administrador']));

        foreach (['http://localhost:5173', 'http://127.0.0.1:5174', 'https://ajeno.example.invalid'] as $origen) {
            $respuesta = $this->solicitar('GET', '/api/mi-sesion', [], $login, $origen)->assertUnauthorized();
            $permitido = $respuesta->headers->get('Access-Control-Allow-Origin');
            $this->assertNotContains($permitido, [$origen, '*']);
        }

        $this->solicitar('GET', '/api/mi-sesion', [], $login, self::ORIGEN_API)->assertOk();
        $this->solicitar('OPTIONS', '/login')->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', self::ORIGEN_WEB)
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_configuracion_https_emite_cookies_secure(): void
    {
        config(['session.secure' => true]);
        $respuesta = $this->get('https://127.0.0.1:8000/sanctum/csrf-cookie')->assertNoContent();

        $this->assertTrue($respuesta->getCookie(config('session.cookie'))->isSecure());
        $this->assertTrue($respuesta->getCookie('XSRF-TOKEN')->isSecure());
    }

    public function test_recordar_es_opcional_y_rechaza_una_opcion_invalida(): void
    {
        $usuario = $this->crearUsuario(['administrador']);
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');
        $this->solicitar('POST', '/login', [
            'email' => $usuario->email, 'password' => $this->clave, 'remember' => 'indefinida',
        ], $csrf)->assertUnprocessable()->assertJsonValidationErrors('remember');

        $login = $this->ingresar($usuario);
        $this->assertNull($login->getCookie(Auth::guard('web')->getRecallerName()));
        $this->assertSame(0, $login->getCookie(config('session.cookie'))->getExpiresTime());
        $this->solicitar('GET', '/api/mi-sesion')->assertUnauthorized();
        $this->travel(121)->minutes();
        $this->solicitar('GET', '/api/mi-sesion', [], $login)->assertUnauthorized();
    }

    public function test_cookie_recordada_se_rechaza_si_fue_alterada_o_si_expira_en_servidor(): void
    {
        config(['session.secure' => true]);
        $usuario = $this->crearUsuario(['administrador']);
        $login = $this->ingresar($usuario, recordar: true);
        $nombre = Auth::guard('web')->getRecallerName();
        $cookie = $login->getCookie($nombre, false);
        $recordar = [$nombre => $cookie->getValue()];
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertTrue($cookie->isSecure());
        $this->assertSame('lax', $cookie->getSameSite());
        $this->assertEmpty($cookie->getDomain());
        $this->assertEqualsWithDelta(now()->addDay()->timestamp, $cookie->getExpiresTime(), 2);

        $alterada = $cookie->getValue();
        $alterada[12] = $alterada[12] === 'a' ? 'b' : 'a';
        $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: [$nombre => $alterada])->assertUnauthorized();

        $this->travel(23)->hours();
        $restaurada = $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recordar)->assertOk();
        $this->assertNull($restaurada->getCookie($nombre));

        $this->travel(61)->minutes();
        // Reenvía deliberadamente la copia de la cookie después de que el navegador la descartaría.
        $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recordar)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', [], $restaurada)->assertUnauthorized();
    }

    public function test_logout_recordado_revoca_la_cookie_y_la_sesion(): void
    {
        $usuario = $this->crearUsuario(['colaborador']);
        $login = $this->ingresar($usuario, recordar: true);
        $nombre = Auth::guard('web')->getRecallerName();
        $recordar = [$nombre => $login->getCookie($nombre, false)->getValue()];
        $restaurada = $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recordar)->assertOk();

        $logout = $this->solicitar('POST', '/logout', [], $restaurada, cookiesExtra: $recordar)->assertNoContent();
        $this->assertTrue($logout->getCookie($nombre, false)->isCleared());
        $this->solicitar('GET', '/api/mi-sesion', [], $restaurada)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recordar)->assertUnauthorized();
    }

    public function test_solicitud_neutral_con_correo_local_y_limites_identicos(): void
    {
        $usuario = $this->crearUsuario(['administrador']);
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');
        $this->solicitar('POST', '/forgot-password', ['email' => $usuario->email], $csrf, enviarCsrf: false)
            ->assertStatus(419);
        $this->solicitar('POST', '/forgot-password', ['email' => 'correo-invalido'], $csrf)
            ->assertUnprocessable()->assertJsonValidationErrors('email');

        foreach ([$usuario->email, 'inexistente@example.invalid'] as $correo) {
            for ($intento = 0; $intento < 3; $intento++) {
                $respuesta = $this->solicitar('POST', '/forgot-password', ['email' => strtoupper($correo)], $csrf)
                    ->assertNoContent(202);
                $this->assertStringContainsString('no-store', $respuesta->headers->get('Cache-Control'));
            }
            $this->solicitar('POST', '/forgot-password', ['email' => $correo], $csrf)
                ->assertTooManyRequests()->assertHeader('Retry-After');
        }

        $mensajes = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $mensajes);
        $this->assertSame($usuario->email, $mensajes->first()->getEnvelope()->getRecipients()[0]->getAddress());
    }

    public function test_administrador_suspende_y_reactiva_sin_restaurar_credenciales_anteriores(): void
    {
        $administrador = $this->crearUsuario(['administrador']);
        $cuenta = $this->crearUsuario(['colaborador', 'finanzas']);
        $actor = $this->ingresar($administrador);
        $anterior = $this->ingresar($cuenta, recordar: true);
        $otraSesion = $this->ingresar($cuenta);
        $nombreCookie = Auth::guard('web')->getRecallerName();
        $recuerdo = [$nombreCookie => $anterior->getCookie($nombreCookie, false)->getValue()];
        $idSesion = $anterior->getCookie(config('session.cookie'))->getValue();
        $sesionEnVuelo = (array) DB::table('sessions')->where('id', $idSesion)->first();
        $roles = $cuenta->roles()->orderBy('codigo')->pluck('codigo')->all();
        $ruta = self::CUENTAS.'/'.$cuenta->id;

        $this->solicitar('GET', self::CUENTAS, [], $actor)->assertOk()->assertJsonFragment([
            'id' => $cuenta->id, 'nombre' => $cuenta->name, 'correo' => $cuenta->email, 'activa' => true,
        ])->assertJsonMissingPath('data.0.version_sesion')->assertJsonMissingPath('data.0.remember_token');
        $this->solicitar('POST', $ruta, ['accion' => 'suspender'], $actor)->assertNoContent();
        $this->solicitar('POST', $ruta, ['accion' => 'suspender'], $actor)->assertNoContent();
        $this->assertFalse($cuenta->refresh()->activa);
        $this->assertDatabaseMissing('sessions', ['user_id' => $cuenta->id]);
        $this->solicitar('GET', '/api/mi-sesion', [], $otraSesion)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recuerdo)->assertUnauthorized();
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');
        $this->solicitar('POST', '/login', ['email' => $cuenta->email, 'password' => $this->clave], $csrf)
            ->assertUnprocessable()->assertJsonPath('message', 'Las credenciales no permiten iniciar sesión.');

        $this->solicitar('POST', $ruta, ['accion' => 'reactivar'], $actor)->assertNoContent();
        $this->assertTrue($cuenta->refresh()->activa);
        $this->assertSame($roles, $cuenta->roles()->orderBy('codigo')->pluck('codigo')->all());
        $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recuerdo)->assertUnauthorized();
        // Representa una petición anterior que terminó de escribir después de revocar.
        DB::table('sessions')->insert($sesionEnVuelo);
        $this->solicitar('GET', '/api/mi-sesion', [], $anterior)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', [], $this->ingresar($cuenta))->assertOk();

        $eventos = DB::table('eventos_de_cuenta')->where('cuenta_id', $cuenta->id)->orderBy('id')->get();
        $this->assertSame(['suspender', 'reactivar'], $eventos->pluck('accion')->all());
        foreach ($eventos as $evento) {
            $this->assertEqualsCanonicalizing(['id', 'actor_id', 'cuenta_id', 'accion', 'created_at'], array_keys((array) $evento));
            $this->assertSame($administrador->id, (int) $evento->actor_id);
            $this->assertSame($cuenta->id, (int) $evento->cuenta_id);
            $this->assertNotEmpty($evento->created_at);
        }
    }

    public function test_revocacion_administrativa_cierra_sesiones_y_recuerdo_con_cuenta_activa(): void
    {
        $administrador = $this->crearUsuario(['administrador']);
        $actor = $this->ingresar($administrador);
        $cuenta = $this->crearUsuario(['colaborador']);
        $destino = $this->ingresar($cuenta, recordar: true);
        $nombreCookie = Auth::guard('web')->getRecallerName();
        $recuerdo = [$nombreCookie => $destino->getCookie($nombreCookie, false)->getValue()];

        $this->solicitar('POST', self::CUENTAS.'/'.$cuenta->id, ['accion' => 'revocar-sesiones'], $actor)->assertNoContent();
        $this->assertTrue($cuenta->refresh()->activa);
        $this->assertDatabaseMissing('sessions', ['user_id' => $cuenta->id]);
        $this->solicitar('GET', '/api/mi-sesion', [], $destino)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recuerdo)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', [], $this->ingresar($cuenta))->assertOk();
        $this->assertDatabaseHas('eventos_de_cuenta', [
            'actor_id' => $administrador->id, 'cuenta_id' => $cuenta->id, 'accion' => 'revocar-sesiones',
        ]);

        $revocada = $this->solicitar('POST', self::CUENTAS.'/'.$administrador->id, ['accion' => 'revocar-sesiones'], $actor);
        $revocada->assertNoContent();
        $this->assertNotSame($actor->getCookie(config('session.cookie'))->getValue(), $revocada->getCookie(config('session.cookie'))->getValue());
        $this->solicitar('GET', self::CUENTAS, [], $revocada)->assertUnauthorized();
    }

    public function test_cuentas_internas_exigen_administrador_csrf_y_acciones_acotadas(): void
    {
        $administrador = $this->crearUsuario(['administrador']);
        $colaborador = $this->crearUsuario(['colaborador']);
        $externa = $this->crearUsuario(['institucion']);
        $actor = $this->ingresar($administrador);
        $intruso = $this->ingresar($colaborador);
        $ruta = self::CUENTAS.'/'.$administrador->id;

        $this->solicitar('GET', self::CUENTAS)->assertUnauthorized();
        $this->solicitar('GET', self::CUENTAS, [], $intruso)->assertForbidden();
        $this->solicitar('GET', self::CUENTAS, [], $actor)->assertOk()
            ->assertJsonMissing(['correo' => $externa->email]);
        foreach (['suspender', 'reactivar', 'revocar-sesiones'] as $accion) {
            $this->solicitar('POST', $ruta, ['accion' => $accion], $intruso)->assertForbidden();
        }
        $this->solicitar('POST', $ruta, ['accion' => 'suspender'], $actor, enviarCsrf: false)->assertStatus(419);
        $this->solicitar('OPTIONS', $ruta)->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', self::ORIGEN_WEB);
        $this->solicitar('POST', $ruta, ['accion' => 'eliminar'], $actor)->assertUnprocessable()
            ->assertJsonValidationErrors('operacion.accion');
        $this->solicitar('POST', $ruta, ['accion' => 'suspender', 'roles' => ['administrador'], 'cuenta' => $externa->id], $actor)
            ->assertUnprocessable()->assertJsonValidationErrors('operacion');
        $this->solicitar('POST', self::CUENTAS.'/'.$externa->id, ['accion' => 'suspender'], $actor)->assertNotFound();
        $this->solicitar('POST', self::CUENTAS.'/0', ['accion' => 'suspender'], $actor)->assertNotFound();
        $this->solicitar('POST', self::CUENTAS.'/99999999999999999999', ['accion' => 'suspender'], $actor)->assertNotFound();
        $this->assertTrue($administrador->refresh()->activa);
        $this->assertTrue($externa->refresh()->activa);
        $this->assertSame(['colaborador'], $colaborador->codigosDeAcceso());
        $this->assertDatabaseMissing('eventos_de_cuenta', ['cuenta_id' => $administrador->id]);
        $this->assertDatabaseMissing('eventos_de_cuenta', ['cuenta_id' => $externa->id]);
    }

    public function test_ultimo_administrador_activo_no_se_puede_suspender(): void
    {
        $primero = $this->crearUsuario(['administrador', 'colaborador']);
        $segundo = $this->crearUsuario(['administrador']);
        $actor = $this->ingresar($primero);

        $this->solicitar('POST', self::CUENTAS.'/'.$segundo->id, ['accion' => 'suspender'], $actor)->assertNoContent();
        $this->solicitar('POST', self::CUENTAS.'/'.$primero->id, ['accion' => 'suspender'], $actor)
            ->assertConflict()->assertJsonPath('message', 'Debe quedar al menos un administrador activo.');
        $this->assertTrue($primero->refresh()->activa);
        $this->assertFalse($segundo->refresh()->activa);
        $this->assertDatabaseMissing('eventos_de_cuenta', ['cuenta_id' => $primero->id]);
        $this->solicitar('GET', self::CUENTAS, [], $actor)->assertOk();
    }

    public function test_el_fallo_smtp_se_persiste_sin_reintentar_ni_exponer_el_enlace(): void
    {
        $usuario = $this->crearUsuario(['administrador']);
        $transporte = new class($this->clave) extends EsmtpTransport
        {
            public int $intentos = 0;

            public ?string $token = null;

            public function __construct(private readonly string $secreto)
            {
                parent::__construct('127.0.0.1', 2525, false);
            }

            protected function doSend(SentMessage $mensaje): void
            {
                $this->intentos++;
                $original = $mensaje->getOriginalMessage();
                preg_match('/#token=([a-f0-9]{64})/', $original->getHtmlBody(), $coincidencia);
                $this->token = $coincidencia[1] ?? null;

                throw new TransportException('SMTP 550 QA '.$this->secreto.' '.$original->getHtmlBody());
            }
        };
        Mail::extend('smtp-qa', fn () => $transporte);
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.transport' => 'smtp-qa']);

        $diagnostico = $this->comprobarFalloDeCorreo($usuario->email, 'El transporte de correo de recuperación no confirmó la entrega.');

        $this->assertSame(1, $transporte->intentos);
        $this->assertNotNull($transporte->token);
        $this->assertFalse(str_contains($diagnostico, $transporte->token), 'El diagnóstico expuso el token.');
        $this->assertFalse(str_contains($diagnostico, 'SMTP 550 QA'), 'El diagnóstico expuso el error SMTP original.');
        $this->assertDatabaseHas('password_reset_tokens', ['email' => $usuario->email]);
    }

    #[TestWith(['smtp'])]
    #[TestWith(['log'])]
    public function test_el_fallo_de_configuracion_se_persiste_sin_exponer_sus_credenciales(string $mailer): void
    {
        $usuario = $this->crearUsuario(['administrador']);
        Mail::extend('smtp-qa-invalido', fn () => throw new RuntimeException('Credencial SMTP QA '.$this->clave));
        config(['mail.default' => $mailer, 'mail.mailers.smtp.transport' => 'smtp-qa-invalido']);

        $diagnostico = $this->comprobarFalloDeCorreo($usuario->email, 'La configuración del correo de recuperación es inválida.');

        $this->assertFalse(str_contains($diagnostico, 'Credencial SMTP QA'), 'El diagnóstico expuso el error de configuración original.');
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $usuario->email]);
    }

    private function comprobarFalloDeCorreo(string $correo, string $mensaje): string
    {
        config([
            'auth.cola_recuperacion' => 'database',
            'queue.connections.database.connection' => 'mysql_pruebas',
            'queue.failed.driver' => 'database-uuids',
            'queue.failed.database' => 'mysql_pruebas',
        ]);
        $captura = new TestHandler;
        Log::swap(new LoggerLaravel(new Logger('correo-qa', [$captura])));
        $cola = 'correo-qa-'.bin2hex(random_bytes(8));
        $ultimo = DB::table('jobs')->max('id') ?? 0;

        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');
        $this->solicitar('POST', '/forgot-password', ['email' => $correo], $csrf)->assertNoContent(202);
        $trabajo = DB::table('jobs')->where('queue', 'recuperacion')->where('id', '>', $ultimo)->sole();
        $payload = json_decode($trabajo->payload, true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame(1, $payload['maxTries']);
        $this->assertFalse(str_contains($trabajo->payload, $correo), 'El trabajo expuso el destinatario.');
        $this->assertTrue(str_contains($this->app['encrypter']->decrypt($payload['data']['command']), $correo));
        DB::table('jobs')->where('id', $trabajo->id)->update(['queue' => $cola]);

        (new SetRequestForConsole)->bootstrap($this->app);
        $opciones = ['connection' => 'database', '--once' => true, '--queue' => $cola, '--tries' => 5];
        Artisan::call('queue:work', $opciones);
        $salida = Artisan::output();

        $fallo = DB::table('failed_jobs')->where('uuid', $payload['uuid'])->first();
        $this->assertNotNull($fallo, 'El trabajador debe registrar el job en failed_jobs.');
        $this->assertSame($cola, $fallo->queue);
        $this->assertTrue($trabajo->payload === $fallo->payload, 'El trabajo fallido debe conservar el payload cifrado.');
        $this->assertTrue(str_contains($fallo->exception, $mensaje), 'El registro omitió el diagnóstico seguro.');
        $this->assertTrue($captura->hasErrorThatContains($mensaje), 'El trabajador omitió el diagnóstico seguro en los logs.');
        $registros = implode('', array_column($captura->getRecords(), 'formatted'));
        $diagnostico = $salida.$fallo->payload.$fallo->exception.$registros;
        $this->assertFalse(str_contains($diagnostico, $correo), 'El diagnóstico expuso el destinatario.');
        $this->assertFalse(str_contains($diagnostico, $this->clave), 'El diagnóstico expuso una credencial.');

        Artisan::call('queue:work', $opciones);
        $this->assertDatabaseMissing('jobs', ['queue' => $cola]);
        $this->assertSame(1, DB::table('failed_jobs')->where('queue', $cola)->count());

        return $diagnostico;
    }

    public function test_restablecer_valida_consume_actualiza_y_revoca_sin_cambiar_roles(): void
    {
        $usuario = $this->crearUsuario(['administrador', 'colaborador']);
        $login = $this->ingresar($usuario, recordar: true);
        $otraSesion = $this->ingresar($usuario);
        $nombre = Auth::guard('web')->getRecallerName();
        $recordar = [$nombre => $login->getCookie($nombre, false)->getValue()];
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');
        $datos = $this->datosDeRestablecimiento($usuario, $csrf);
        $hashToken = DB::table('password_reset_tokens')->where('email', $usuario->email)->value('token');
        $this->assertTrue(Hash::check($datos['token'], $hashToken));
        $this->assertFalse(hash_equals($hashToken, $datos['token']));

        $this->solicitar('POST', '/reset-password', $datos, $csrf, enviarCsrf: false)->assertStatus(419);
        $fallo = $this->solicitar('POST', '/reset-password', array_replace($datos, ['token' => str_repeat('f', 64)]), $csrf)
            ->assertUnprocessable()->assertJsonValidationErrors('token')->json();
        $this->solicitar('POST', '/reset-password', array_replace($datos, ['email' => 'inexistente@example.invalid']), $csrf)
            ->assertUnprocessable()->assertExactJson($fallo);
        $this->solicitar('POST', '/reset-password', array_replace($datos, ['password_confirmation' => 'No-coincide']), $csrf)
            ->assertUnprocessable()->assertJsonValidationErrors('password_confirmation');

        $this->solicitar('POST', '/reset-password', [...$datos, 'roles' => ['institucion']], $csrf)->assertNoContent();
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $usuario->email]);
        $this->assertDatabaseMissing('sessions', ['user_id' => $usuario->id]);
        $this->assertTrue(Hash::check($datos['password'], $usuario->fresh()->password));
        $this->assertSame(['administrador', 'colaborador'], $usuario->fresh()->codigosDeAcceso());
        $this->solicitar('GET', '/api/mi-sesion', [], $login)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', [], $otraSesion)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', cookiesExtra: $recordar)->assertUnauthorized();
        $this->solicitar('GET', '/api/mi-sesion', [], $csrf)->assertUnauthorized();
        $this->solicitar('POST', '/reset-password', $datos, $csrf)->assertUnprocessable()->assertExactJson($fallo);
        $this->solicitar('POST', '/login', ['email' => $usuario->email, 'password' => $this->clave], $csrf)
            ->assertUnprocessable();
        $this->solicitar('POST', '/login', ['email' => $usuario->email, 'password' => $datos['password']], $csrf)
            ->assertNoContent();
    }

    public function test_restablecimiento_rechaza_token_vencido_y_limita_intentos(): void
    {
        $usuario = $this->crearUsuario(['administrador']);
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie');
        $datos = $this->datosDeRestablecimiento($usuario, $csrf);
        $this->travel(31)->minutes();

        for ($intento = 0; $intento < 8; $intento++) {
            $this->solicitar('POST', '/reset-password', $datos, $csrf)
                ->assertUnprocessable()->assertJsonValidationErrors('token');
        }

        $this->solicitar('POST', '/reset-password', $datos, $csrf)
            ->assertTooManyRequests()->assertHeader('Retry-After');
        $this->assertTrue(Hash::check($this->clave, $usuario->fresh()->password));
    }

    private function datosDeRestablecimiento(User $usuario, TestResponse $csrf): array
    {
        $this->solicitar('POST', '/forgot-password', ['email' => $usuario->email], $csrf)->assertNoContent(202);
        $mensaje = Mail::mailer('array')->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
        $this->assertSame(1, preg_match('~http://127\.0\.0\.1:5173/restablecer-contrasena#token=([a-f0-9]{64})~', $mensaje->getHtmlBody(), $coincidencia));
        $clave = bin2hex(random_bytes(16));

        return [
            'email' => $usuario->email, 'token' => $coincidencia[1],
            'password' => $clave, 'password_confirmation' => $clave,
        ];
    }

    private function crearUsuario(array $roles): User
    {
        $usuario = User::factory()->unverified()->create([
            'name' => 'Persona ficticia',
            'email' => bin2hex(random_bytes(8)).'@example.invalid',
            'password' => $this->clave,
        ]);
        $usuario->roles()->attach(Rol::query()->whereIn('codigo', $roles)->pluck('id'));

        return $usuario;
    }

    private function ingresar(User $usuario, bool $recordar = false): TestResponse
    {
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie')->assertNoContent();

        return $this->solicitar('POST', '/login', [
            'email' => $usuario->email, 'password' => $this->clave, ...($recordar ? ['remember' => true] : []),
        ], $csrf)
            ->assertNoContent();
    }

    private function solicitar(
        string $metodo,
        string $ruta,
        array $datos = [],
        ?TestResponse $respuestaAnterior = null,
        string $origen = self::ORIGEN_WEB,
        bool $enviarCsrf = true,
        array $cookiesExtra = [],
    ): TestResponse {
        Auth::forgetGuards();
        $this->app->forgetInstance('auth.driver');
        $this->app['session']->forgetDrivers();
        $this->app->forgetInstance('session.store');
        $this->app['cookie']->flushQueuedCookies();
        foreach ($this->app['router']->getRoutes() as $rutaRegistrada) {
            $rutaRegistrada->flushController();
        }

        $cookies = [];
        $cabeceras = ['HTTP_ORIGIN' => $origen, 'HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'];
        if ($respuestaAnterior !== null) {
            $nombre = config('session.cookie');
            $cookies[$nombre] = $respuestaAnterior->getCookie($nombre, false)->getValue();
            if ($enviarCsrf) {
                $cabeceras['HTTP_X_XSRF_TOKEN'] = $respuestaAnterior->getCookie('XSRF-TOKEN', false)->getValue();
            }
        }
        if ($metodo === 'OPTIONS') {
            $cabeceras['HTTP_ACCESS_CONTROL_REQUEST_METHOD'] = 'POST';
            $cabeceras['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] = 'content-type,x-xsrf-token';
        }

        return $this->call($metodo, self::ORIGEN_API.$ruta, [], $cookies + $cookiesExtra, [], $cabeceras, json_encode($datos));
    }
}
