<?php

namespace Tests\MySql;

use App\Actions\Autenticacion\RegistrarGraduando;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Symfony\Component\Process\InputStream;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class RegistroGraduandoConcurrenciaTest extends TestCase
{
    public function test_dos_procesos_consumen_una_sola_verificacion_y_crean_una_sola_cuenta(): void
    {
        if (! ($datadir = getenv('ME_REGISTRO_MYSQL_TEMPORAL'))) {
            $this->markTestSkipped('Requiere una instancia desechable de MySQL con datadir explícito.');
        }

        $this->assertTrue(app()->environment('testing'));
        $conexion = DB::connection('mysql_pruebas');
        $instancia = $conexion->selectOne('SELECT DATABASE() AS nombre, @@datadir AS ruta, @@port AS puerto');
        $this->assertSame('masterexpress_control_test', $instancia->nombre);
        $this->assertNotSame(3306, (int) $instancia->puerto);
        $this->assertNotFalse(realpath($datadir));
        $this->assertSame(realpath($datadir), realpath($instancia->ruta));

        $clave = 'base64:'.base64_encode(random_bytes(32));
        config([
            'app.key' => $clave,
            'queue.connections.database.connection' => 'mysql_pruebas',
            'session.driver' => 'database',
            'session.connection' => 'mysql_pruebas',
            'session.secure' => false,
            'session.domain' => null,
        ]);
        DB::setDefaultConnection('mysql_pruebas');
        $correo = 'simultaneo-'.Str::lower(Str::random(12)).'@example.invalid';
        $cookies = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $sesion = app('session.store')->getId();
        $navegador = [
            'nombre' => config('session.cookie'),
            'sesion' => $cookies->getCookie(config('session.cookie'), false)->getValue(),
            'csrf' => $cookies->getCookie('XSRF-TOKEN', false)->getValue(),
        ];
        $registro = app(RegistrarGraduando::class);
        $procesos = [];

        try {
            $registro->solicitar($correo, $sesion);
            $this->assertSame(0, Artisan::call('queue:work', ['connection' => 'database', '--queue' => 'registro-graduando', '--once' => true]));
            $mensaje = Mail::mailer()->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
            $this->assertSame($correo, $mensaje->getTo()[0]->getAddress());
            $this->assertSame(1, preg_match('/\b[0-9]{6}\b/', $mensaje->getTextBody(), $codigo));
            $registro->confirmar($correo, $sesion, $codigo[0]);

            $datos = ['email' => $correo, 'nombres' => 'Primera', 'apellidos' => 'Persona',
                'telefono' => '0310001234', 'password' => 'Clave ficticia para concurrencia',
                'password_confirmation' => 'Clave ficticia para concurrencia'];
            [$primero, $entrada] = $this->iniciarProceso($clave, $navegador, $datos, 'primero');
            $procesos[] = $primero;
            $this->assertTrue($primero->waitUntil(fn ($tipo, $salida) => str_contains($salida, 'escrito')));
            $this->assertTrue($primero->isRunning());

            [$segundo] = $this->iniciarProceso($clave, $navegador, ['nombres' => 'Segunda'] + $datos, 'segundo');
            $procesos[] = $segundo;
            $this->assertTrue($segundo->waitUntil(fn ($tipo, $salida) => str_contains($salida, 'compitiendo')));
            $this->assertTrue($segundo->isRunning());
            $entrada->write("continuar\n");
            $entrada->close();

            $this->assertSame(0, $primero->wait());
            $this->assertSame(0, $segundo->wait());
            $this->assertStringContainsString('http:204', $primero->getOutput());
            $this->assertStringContainsString('http:204', $segundo->getOutput());
            $usuario = User::query()->where('email', $correo)->sole();
            $this->assertSame('Primera Persona', $usuario->name);
            $this->assertSame(['graduando'], $usuario->roles()->pluck('codigo')->all());
            $this->assertDatabaseHas('desafios_de_registro', ['estado' => 'consumido']);
        } finally {
            foreach ($procesos as $proceso) {
                if ($proceso->isRunning()) {
                    $proceso->stop(0);
                }
            }
            User::query()->where('email', $correo)->delete();
            DB::table('sessions')->where('id', $sesion)->delete();
            DB::table('desafios_de_registro')->where('clave', hash_hmac(
                'sha256', "registro-graduando\0correo\0".$correo, app('encrypter')->getKey(),
            ))->delete();
        }
    }

    private function iniciarProceso(string $clave, array $navegador, array $datos, string $turno): array
    {
        $programa = <<<'PHP'
            require 'vendor/autoload.php';
            $app = require 'bootstrap/app.php';
            $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
            $base = $app['db'];
            $base->setDefaultConnection('mysql_pruebas');
            [$navegador, $datos, $turno] = json_decode(fgets(STDIN), true, flags: JSON_THROW_ON_ERROR);
            config([
                'session.cookie' => $navegador['nombre'], 'session.driver' => 'database',
                'session.connection' => 'mysql_pruebas', 'session.secure' => false, 'session.domain' => null,
                'cache.limiter' => 'array',
            ]);
            $app->bind(Illuminate\Foundation\Http\Middleware\PreventRequestForgery::class, fn ($app) =>
                new class($app, $app['encrypter']) extends Illuminate\Foundation\Http\Middleware\PreventRequestForgery
                {
                    protected function runningUnitTests(): bool
                    {
                        return false;
                    }
                }
            );
            $base->connection()->beforeExecuting(function (string $sql) use ($turno): void {
                if ($turno === 'primero' && str_starts_with($sql, 'update `desafios_de_registro`')) {
                    fwrite(STDOUT, "escrito\n");
                    fflush(STDOUT);
                    if (trim((string) fgets(STDIN)) !== 'continuar') {
                        throw new RuntimeException('Se interrumpió la coordinación de QA.');
                    }
                }
                if ($turno === 'segundo' && str_contains($sql, 'from `desafios_de_registro`') && str_contains($sql, 'for update')) {
                    fwrite(STDOUT, "compitiendo\n");
                    fflush(STDOUT);
                }
            });
            $peticion = Illuminate\Http\Request::create('/api/registro-graduando/cuenta', 'POST', [],
                [$navegador['nombre'] => $navegador['sesion']], [], [
                    'HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json',
                    'HTTP_X_XSRF_TOKEN' => $navegador['csrf'],
                ], json_encode($datos, JSON_THROW_ON_ERROR));
            $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
            $respuesta = $kernel->handle($peticion);
            $kernel->terminate($peticion, $respuesta);
            fwrite(STDOUT, 'http:'.$respuesta->getStatusCode().PHP_EOL);
            PHP;

        $entrada = new InputStream;
        $entrada->write(json_encode([$navegador, $datos, $turno], JSON_THROW_ON_ERROR)."\n");
        if ($turno === 'segundo') {
            $entrada->close();
        }
        $proceso = new Process([PHP_BINARY, '-r', $programa], base_path(), [
            'APP_ENV' => 'testing', 'APP_KEY' => $clave, 'APP_DEBUG' => 'false',
            'DB_CONNECTION' => 'mysql_pruebas', 'BCRYPT_ROUNDS' => '4',
        ], $entrada, 15);
        $proceso->start();

        return [$proceso, $entrada];
    }
}
