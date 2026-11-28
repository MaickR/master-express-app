<?php

namespace Tests\MySql;

use App\Models\Graduando;
use App\Models\Rol;
use App\Models\User;
use App\Models\VinculoGraduando;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\InputStream;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class VinculacionGraduandosConcurrenciaTest extends TestCase
{
    public function test_dos_confirmaciones_simultaneas_dejan_un_solo_vinculo(): void
    {
        $conexion = DB::connection('mysql_pruebas');
        $identidad = $conexion->selectOne('SELECT DATABASE() AS nombre, @@port AS puerto');
        $this->assertSame('masterexpress_control_test', $identidad->nombre);
        if ((int) $identidad->puerto === 3306) {
            $this->markTestSkipped('La vinculación concurrente se ejecuta en MySQL temporal, fuera del puerto 3306.');
        }

        DB::setDefaultConnection('mysql_pruebas');
        $administrador = $this->usuario('administrador');
        $cuenta = $this->usuario('graduando');
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona concurrente']);
        $procesos = [];

        try {
            [$primero, $entrada] = $this->iniciarProceso($administrador->id, $cuenta->id, $graduando->id, 'primero');
            $procesos[] = $primero;
            $this->assertTrue($primero->waitUntil(fn ($tipo, $salida) => str_contains($salida, 'escrito')));
            $this->assertTrue($primero->isRunning());

            [$segundo] = $this->iniciarProceso($administrador->id, $cuenta->id, $graduando->id, 'segundo');
            $procesos[] = $segundo;
            $this->assertTrue($segundo->waitUntil(fn ($tipo, $salida) => str_contains($salida, 'compitiendo')));
            $entrada->write("continuar\n");
            $entrada->close();

            $this->assertSame(0, $primero->wait());
            $this->assertSame(0, $segundo->wait());
            $estados = [$this->estado($primero->getOutput()), $this->estado($segundo->getOutput())];
            sort($estados);
            $this->assertSame([201, 409], $estados);
            $this->assertSame(1, VinculoGraduando::query()->where('graduando_id', $graduando->id)->count());
            $this->assertSame($cuenta->id, (int) VinculoGraduando::query()->where('graduando_id', $graduando->id)->value('user_id'));
        } finally {
            foreach ($procesos as $proceso) {
                if ($proceso->isRunning()) {
                    $proceso->stop(0);
                }
            }
            DB::table('auditoria_vinculos_graduandos')->where('graduando_id', $graduando->id)->delete();
            DB::table('vinculos_de_graduandos')->where('graduando_id', $graduando->id)->delete();
            $graduando->delete();
            foreach ([$cuenta, $administrador] as $usuario) {
                $usuario->roles()->detach();
                $usuario->delete();
            }
        }
    }

    private function estado(string $salida): int
    {
        $this->assertSame(1, preg_match('/http:(\d+)/', $salida, $coincidencias));

        return (int) $coincidencias[1];
    }

    /** @return array{0: Process, 1: InputStream} */
    private function iniciarProceso(int $administrador, int $cuenta, int $graduando, string $turno): array
    {
        $programa = <<<'PHP'
            require 'vendor/autoload.php';
            $app = require 'bootstrap/app.php';
            $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
            $app['db']->setDefaultConnection('mysql_pruebas');
            [$administradorId, $cuentaId, $graduandoId, $turno] = json_decode(fgets(STDIN), true, flags: JSON_THROW_ON_ERROR);
            $app['db']->connection()->beforeExecuting(function (string $sql) use ($turno): void {
                if ($turno === 'primero' && str_contains($sql, 'insert into `vinculos_de_graduandos`')) {
                    fwrite(STDOUT, "escrito\n");
                    fflush(STDOUT);
                    if (trim((string) fgets(STDIN)) !== 'continuar') {
                        throw new RuntimeException('Se interrumpió la coordinación de QA.');
                    }
                }
                if ($turno === 'segundo' && str_contains($sql, 'for update') && str_contains($sql, '`users`')) {
                    fwrite(STDOUT, "compitiendo\n");
                    fflush(STDOUT);
                }
            });
            try {
                $administrador = App\Models\User::query()->findOrFail($administradorId);
                app(App\Actions\VincularGraduando::class)->ejecutar($administrador, $graduandoId, $cuentaId);
                $estado = 201;
            } catch (Symfony\Component\HttpKernel\Exception\HttpException $error) {
                $estado = $error->getStatusCode();
            }
            fwrite(STDOUT, 'http:'.$estado.PHP_EOL);
            PHP;

        $entrada = new InputStream;
        $entrada->write(json_encode([$administrador, $cuenta, $graduando, $turno], JSON_THROW_ON_ERROR)."\n");
        if ($turno === 'segundo') {
            $entrada->close();
        }
        $conexion = config('database.connections.mysql_pruebas');
        $proceso = new Process([PHP_BINARY, '-r', $programa], base_path(), [
            'APP_ENV' => 'testing',
            'APP_KEY' => (string) config('app.key'),
            'APP_DEBUG' => 'false',
            'DB_CONNECTION' => 'mysql_pruebas',
            'ME_MYSQL_TEST_PORT' => (string) $conexion['port'],
            'ME_MYSQL_TEST_USERNAME' => (string) $conexion['username'],
            'ME_MYSQL_TEST_PASSWORD' => (string) $conexion['password'],
            'BCRYPT_ROUNDS' => '4',
        ], $entrada, 20);
        $proceso->start();

        return [$proceso, $entrada];
    }

    private function usuario(string $rol): User
    {
        $usuario = User::factory()->create(['name' => 'Persona ficticia', 'email' => Str::uuid().'@example.invalid']);
        $usuario->roles()->attach(Rol::query()->where('codigo', $rol)->sole()->id);

        return $usuario->refresh();
    }
}
