<?php

namespace Tests\MySql;

use App\Actions\ProgramarEvento;
use App\Models\Graduando;
use App\Models\Institucion;
use App\Models\Registro;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\InputStream;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class GestionGraduandosConcurrenciaTest extends TestCase
{
    public function test_altas_simultaneas_y_edicion_compiten_sin_duplicar_ni_perder_cambios(): void
    {
        $conexion = DB::connection('mysql_pruebas');
        $this->assertSame(3338, (int) $conexion->selectOne('SELECT @@port AS puerto')->puerto);
        DB::setDefaultConnection('mysql_pruebas');
        $primero = $this->cuenta();
        $segundo = $this->cuenta();
        $documento = (string) random_int(10000000, 99999999);
        $datos = ['nombre_completo' => 'Persona concurrente QA', 'tipo_documento' => 'CC', 'numero_documento' => $documento,
            'correo' => null, 'telefono' => null, 'operation_id' => (string) Str::uuid()];
        $this->competir([$primero->id, $datos, null], [$primero->id, $datos, null], [201, 201]);
        $fila = Graduando::query()->where('numero_documento', $documento)->sole();
        $this->assertSame(1, Graduando::query()->where('numero_documento', $documento)->count());
        $datos['numero_documento'] .= '9';
        $datos['operation_id'] = (string) Str::uuid();
        $alternos = array_replace($datos, ['operation_id' => (string) Str::uuid()]);
        $this->competir([$primero->id, $datos, null], [$segundo->id, $alternos, null], [201, 409]);
        $this->assertSame(1, Graduando::query()->where('numero_documento', $datos['numero_documento'])->count());
        unset($datos['operation_id']);
        $datos['numero_documento'] = $documento;
        $datos['revision'] = 1;
        $this->competir([$primero->id, $datos, $fila->id], [$segundo->id, array_replace($datos, ['nombre_completo' => 'Otro cambio']), $fila->id], [200, 409]);
        $this->assertSame(2, $fila->refresh()->revision);
    }

    public function test_inscripciones_simultaneas_recuperan_resultado_y_conservan_unicidad(): void
    {
        $conexion = DB::connection('mysql_pruebas');
        $this->assertSame(3338, (int) $conexion->selectOne('SELECT @@port AS puerto')->puerto);
        DB::setDefaultConnection('mysql_pruebas');
        $primero = $this->cuenta();
        $segundo = $this->cuenta();
        $institucion = Institucion::create(['nombre' => 'Institución concurrente QA', 'tipo' => 'colegio']);
        $evento = app(ProgramarEvento::class)->ejecutar($primero, [
            'institucion_id' => $institucion->id, 'sede_id' => $institucion->sedes()->create(['nombre' => 'Sede QA'])->id,
            'fecha' => '2099-03-01', 'numero_ceremonias' => 1, 'operation_id' => (string) Str::uuid(),
        ]);
        $graduando = Graduando::create(['nombre_completo' => 'Inscripción concurrente QA']);
        $ceremonia = $evento->ceremonias->first()->id;
        $datos = ['operation_id' => (string) Str::uuid(), 'evento_id' => $evento->id, 'graduando_id' => $graduando->id];
        $this->competir([$primero->id, $datos, $ceremonia, 'inscripcion'], [$primero->id, $datos, $ceremonia, 'inscripcion'], [201, 201]);
        $this->assertSame(1, Registro::where('graduando_id', $graduando->id)->count());
        $otro = Graduando::create(['nombre_completo' => 'Otra inscripción concurrente QA']);
        $datos = array_replace($datos, ['operation_id' => (string) Str::uuid(), 'graduando_id' => $otro->id]);
        $alternos = array_replace($datos, ['operation_id' => (string) Str::uuid()]);
        $this->competir([$primero->id, $datos, $ceremonia, 'inscripcion'], [$segundo->id, $alternos, $ceremonia, 'inscripcion'], [201, 409]);
        $this->assertSame(1, Registro::where('graduando_id', $otro->id)->count());
    }

    private function competir(array $uno, array $dos, array $esperados): void
    {
        $procesos = [];
        try {
            [$primero, $entrada] = $this->proceso($uno, 'primero');
            $procesos[] = $primero;
            $this->assertTrue($primero->waitUntil(fn ($tipo, $salida) => str_contains($salida, 'retenido')));
            [$segundo] = $this->proceso($dos, 'segundo');
            $procesos[] = $segundo;
            $this->assertTrue($segundo->waitUntil(fn ($tipo, $salida) => str_contains($salida, 'compitiendo')));
            $entrada->write("continuar\n");
            $entrada->close();
            $estados = [];
            foreach ($procesos as $proceso) {
                $this->assertSame(0, $proceso->wait(), $proceso->getErrorOutput());
                $this->assertSame(1, preg_match('/http:(\d+)/', $proceso->getOutput(), $coincidencias));
                $estados[] = (int) $coincidencias[1];
            }
            sort($estados);
            $this->assertSame($esperados, $estados);
        } finally {
            foreach ($procesos as $proceso) {
                if ($proceso->isRunning()) {
                    $proceso->stop(0);
                }
            }
        }
    }

    private function proceso(array $datos, string $turno): array
    {
        $programa = <<<'PHP'
            require 'vendor/autoload.php';
            $app = require 'bootstrap/app.php';
            $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
            $app['db']->setDefaultConnection('mysql_pruebas');
            [$datos, $turno] = json_decode(fgets(STDIN), true);
            [$actor, $entrada, $id] = $datos;
            $tipoOperacion = $datos[3] ?? 'perfil';
            $app['db']->connection()->beforeExecuting(function (string $sql) use ($turno): void {
                if ($turno === 'segundo' && str_contains($sql, 'for update') && str_contains($sql, '`users`')) {
                    fwrite(STDOUT, "compitiendo\n"); fflush(STDOUT);
                }
                if ($turno === 'primero' && ((str_contains($sql, 'insert into `graduandos`') || str_contains($sql, 'insert into `registros`')) || str_starts_with($sql, 'update `graduandos`'))) {
                    fwrite(STDOUT, "retenido\n"); fflush(STDOUT);
                    if (trim(fgets(STDIN)) !== 'continuar') { throw new RuntimeException('Coordinación interrumpida.'); }
                }
            });
            try {
                if ($tipoOperacion === 'inscripcion') {
                    app(App\Actions\InscribirGraduando::class)->ejecutar(App\Models\User::findOrFail($actor), (string) $id, $entrada);
                    $estado = 201;
                } else {
                    app(App\Actions\GuardarGraduandoOperativo::class)->ejecutar(App\Models\User::findOrFail($actor), $entrada, $id);
                    $estado = $id === null ? 201 : 200;
                }
            } catch (Symfony\Component\HttpKernel\Exception\HttpException $error) {
                $estado = $error->getStatusCode();
            }
            fwrite(STDOUT, 'http:'.$estado.PHP_EOL);
            PHP;
        $entrada = new InputStream;
        $entrada->write(json_encode([$datos, $turno])."\n");
        if ($turno === 'segundo') {
            $entrada->close();
        }
        $config = config('database.connections.mysql_pruebas');
        $proceso = new Process([PHP_BINARY, '-r', $programa], base_path(), [
            'APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql_pruebas', 'APP_KEY' => config('app.key'),
            'ME_MYSQL_TEST_PORT' => (string) $config['port'], 'ME_MYSQL_TEST_USERNAME' => $config['username'],
            'ME_MYSQL_TEST_PASSWORD' => $config['password'], 'LOG_CHANNEL' => 'null',
        ], $entrada, 120);
        $proceso->start();

        return [$proceso, $entrada];
    }

    private function cuenta(): User
    {
        $usuario = User::factory()->create();
        $usuario->roles()->attach(Rol::query()->where('codigo', 'administrador')->sole()->id);

        return $usuario->refresh();
    }
}
