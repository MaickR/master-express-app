<?php

namespace App\Console\Commands;

use App\Actions\Autenticacion\RevocarSesiones;
use App\Models\Institucion;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PDOException;

class EnsayoEventos extends Command
{
    public const string CORREO = 'qa.eventos@example.invalid';

    /** @var list<array{nombre: string, tipo: string}> */
    public const array INSTITUCIONES = [
        ['nombre' => 'Colegio Ficticio Beta QA', 'tipo' => 'colegio'],
        ['nombre' => 'Universidad Ficticia Alfa QA', 'tipo' => 'universidad'],
        ['nombre' => 'Universidad Ficticia Gamma QA', 'tipo' => 'universidad'],
    ];

    protected $signature = 'qa:ensayo-eventos {accion : preparar o cerrar}';

    protected $description = 'Prepara o cierra los datos ficticios del ensayo de eventos en la base MySQL aislada de pruebas';

    public function handle(RevocarSesiones $revocar): int
    {
        $accion = $this->argument('accion');

        if (! in_array($accion, ['preparar', 'cerrar'], true)) {
            $this->error('Indique la acción preparar o cerrar.');

            return self::FAILURE;
        }

        if (! app()->environment('testing') || DB::getDefaultConnection() !== 'mysql_pruebas') {
            $this->error('Use APP_ENV=testing y DB_CONNECTION=mysql_pruebas.');

            return self::FAILURE;
        }

        try {
            $conexion = DB::connection();
            $aislada = $conexion->selectOne('SELECT DATABASE() AS nombre')->nombre === 'masterexpress_control_test'
                && ! $conexion->table('information_schema.SCHEMATA')->where('SCHEMA_NAME', 'masterexpress_control_dev')->exists();

            if (! $aislada) {
                $this->error('La conexión no corresponde a la base aislada de pruebas.');

                return self::FAILURE;
            }

            return $accion === 'preparar' ? $this->preparar() : $this->cerrar($revocar);
        } catch (PDOException) {
            $this->error('MySQL no pudo completar la operación. Verifique el esquema migrado y los permisos.');
        }

        return self::FAILURE;
    }

    private function preparar(): int
    {
        // ! La contraseña ficticia llega solo por el entorno del proceso y no se imprime ni se guarda en archivos.
        $clave = (string) env('ME_QA_CLAVE', '');
        $rol = Rol::query()->where('codigo', 'administrador')->first();

        if (mb_strlen($clave) < 12 || strlen($clave) > 72 || ! $rol) {
            $this->error('Defina ME_QA_CLAVE (12 caracteres a 72 bytes) y el catálogo de roles.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($clave, $rol): void {
            foreach (self::INSTITUCIONES as $institucion) {
                Institucion::query()->firstOrCreate($institucion)->sedes()->firstOrCreate(['nombre' => 'Sede Principal']);
            }

            $cuenta = User::query()->lockForUpdate()->firstWhere('email', self::CORREO)
                ?? new User(['email' => self::CORREO]);
            $cuenta->fill(['name' => 'Administración QA ficticia', 'password' => $clave]);
            $cuenta->forceFill(['activa' => true])->saveOrFail();
            $cuenta->roles()->syncWithoutDetaching([$rol->id]);
        });

        $this->info('Ensayo preparado con instituciones y cuenta ficticias.');

        return self::SUCCESS;
    }

    private function cerrar(RevocarSesiones $revocar): int
    {
        // * La cuenta queda suspendida para no alterar las reglas de administración que comprueban las pruebas.
        DB::transaction(function () use ($revocar): void {
            $cuenta = User::query()->lockForUpdate()->firstWhere('email', self::CORREO);

            if ($cuenta) {
                $cuenta->forceFill(['activa' => false]);
                $revocar->ejecutar($cuenta);
            }
        });

        $this->info('Ensayo cerrado. La cuenta ficticia quedó suspendida y sin sesiones.');

        return self::SUCCESS;
    }
}
