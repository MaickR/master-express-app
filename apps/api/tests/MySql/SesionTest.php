<?php

namespace Tests\MySql;

use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\Auth;
use Illuminate\Testing\TestResponse;

class SesionTest extends CasoMySql
{
    private const string ORIGEN_WEB = 'http://127.0.0.1:5173';

    private const string ORIGEN_API = 'http://127.0.0.1:8000';

    protected array $tablas = ['users', 'roles', 'rol_user', 'sessions'];

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
            'remember' => true,
        ], $csrf)->assertNoContent();
        $sesion = $login->getCookie(config('session.cookie'))->getValue();
        $this->assertNotSame($cookie->getValue(), $sesion);
        $this->assertDatabaseMissing('sessions', ['id' => $cookie->getValue()]);
        $this->assertDatabaseHas('sessions', ['id' => $sesion, 'user_id' => $usuario->id]);
        $this->assertCount(2, $login->headers->getCookies());

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

    private function ingresar(User $usuario): TestResponse
    {
        $csrf = $this->solicitar('GET', '/sanctum/csrf-cookie')->assertNoContent();

        return $this->solicitar('POST', '/login', ['email' => $usuario->email, 'password' => $this->clave], $csrf)
            ->assertNoContent();
    }

    private function solicitar(
        string $metodo,
        string $ruta,
        array $datos = [],
        ?TestResponse $respuestaAnterior = null,
        string $origen = self::ORIGEN_WEB,
        bool $enviarCsrf = true,
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

        return $this->call($metodo, self::ORIGEN_API.$ruta, [], $cookies, [], $cabeceras, json_encode($datos));
    }
}
