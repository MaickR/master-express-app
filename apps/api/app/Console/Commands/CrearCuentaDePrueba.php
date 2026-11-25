<?php

namespace App\Console\Commands;

use App\Models\Rol;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use PDOException;

class CrearCuentaDePrueba extends Command
{
    protected $signature = 'auth:crear-cuenta-prueba';

    protected $description = 'Crea una cuenta ficticia interna en la base MySQL local de desarrollo';

    public function handle(): int
    {
        if (! app()->environment('local') || ! $this->input->isInteractive()) {
            $this->error('Use una terminal interactiva en el entorno local.');

            return self::FAILURE;
        }

        $conexion = DB::connection();

        if ($conexion->getDriverName() !== 'mysql'
            || $conexion->getConfig('host') !== '127.0.0.1'
            || $conexion->getDatabaseName() !== 'masterexpress_control_dev') {
            $this->error('La conexión debe apuntar a MySQL local de desarrollo.');

            return self::FAILURE;
        }

        try {
            if ($conexion->selectOne('SELECT DATABASE() AS nombre')->nombre !== 'masterexpress_control_dev') {
                $this->error('MySQL identificó una base diferente a la autorizada.');

                return self::FAILURE;
            }

            return $this->crearCuenta();
        } catch (UniqueConstraintViolationException) {
            $this->error('Ya existe una cuenta con ese correo.');
        } catch (PDOException) {
            $this->error('MySQL no pudo completar la operación. Verifique la conexión, el esquema y los permisos.');
        }

        return self::FAILURE;
    }

    private function crearCuenta(): int
    {
        $nombre = trim((string) $this->ask('Nombre ficticio'));
        $correo = Str::lower(trim((string) $this->ask('Correo ficticio (@example.invalid)')));
        $entradaValida = Validator::make(['nombre' => $nombre, 'correo' => $correo], [
            'nombre' => ['required', 'string', 'max:255'],
            'correo' => ['required', 'email:rfc', 'max:255', 'ends_with:@example.invalid'],
        ])->passes();

        if (! $entradaValida) {
            $this->error('Indique un nombre y un correo ficticio válido de example.invalid.');

            return self::FAILURE;
        }

        $roles = $this->choice('Seleccione uno o varios roles separados por coma', User::ROLES_DE_ACCESO, null, null, true);
        $idsDeRoles = Rol::query()->whereIn('codigo', $roles)->pluck('id');

        if ($idsDeRoles->isEmpty() || $idsDeRoles->count() !== count(array_unique($roles))) {
            $this->error('El catálogo de roles no está disponible.');

            return self::FAILURE;
        }

        $clave = $this->secret('Contraseña de prueba (mínimo 12 caracteres y máximo 72 bytes)', false);
        $confirmacion = $this->secret('Confirme la contraseña de prueba', false);

        if (! is_string($clave) || mb_strlen($clave) < 12 || strlen($clave) > 72 || $clave !== $confirmacion) {
            $this->error('Las contraseñas deben coincidir y cumplir los límites indicados.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($nombre, $correo, $clave, $idsDeRoles): void {
            $usuario = User::query()->create(['name' => $nombre, 'email' => $correo, 'password' => $clave]);
            $usuario->roles()->attach($idsDeRoles);
        });

        $this->info('Cuenta ficticia creada.');

        return self::SUCCESS;
    }
}
