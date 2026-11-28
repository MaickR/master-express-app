<?php

namespace App\Console\Commands;

use App\Actions\Autenticacion\RevocarSesiones;
use App\Http\Requests\ContrasenaDeCuenta;
use App\Models\EventoDeCuenta;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PrepararAdministradorPrincipal extends Command
{
    protected $signature = 'cuentas:principal-qa {id : ID existente confirmado por el responsable} {--establecer-clave : Entrada oculta voluntaria} {--clave-stdin : Entrada privada mediante el ejecutor local}';

    protected $description = 'Protege la identidad administrativa existente en MySQL QA; no crea usuarios';

    public function handle(RevocarSesiones $revocar): int
    {
        $conexion = DB::connection();
        if (! app()->environment('testing') || ! $this->input->isInteractive()
            || config('database.default') !== 'mysql_pruebas'
            || $conexion->getConfig('host') !== '127.0.0.1'
            || $conexion->getDatabaseName() !== 'masterexpress_control_test'
            || $conexion->selectOne('SELECT DATABASE() AS nombre')->nombre !== 'masterexpress_control_test') {
            $this->error('Requiere terminal interactiva y conexión MySQL QA local confirmada.');

            return self::FAILURE;
        }

        $clave = null;
        if ($this->option('establecer-clave') && $this->option('clave-stdin')) {
            $this->error('Selecciona un solo mecanismo de entrada privada.');

            return self::FAILURE;
        }
        if ($this->option('establecer-clave') || $this->option('clave-stdin')) {
            if ($this->option('clave-stdin')) {
                $entrada = json_decode(stream_get_contents(STDIN, 8192), true);
                $clave = is_array($entrada) ? ($entrada['password'] ?? null) : null;
                $confirmacion = is_array($entrada) ? ($entrada['password_confirmation'] ?? null) : null;
                unset($entrada);
            } else {
                $clave = $this->secret('Contraseña elegida por el titular', false);
                $confirmacion = $this->secret('Confirma la contraseña', false);
            }
            if ($clave !== $confirmacion || ! Validator::make(['password' => $clave], [
                'password' => ContrasenaDeCuenta::reglas(),
            ])->passes()) {
                $this->error('La contraseña no cumple los límites o no coincide.');

                return self::FAILURE;
            }
        }

        try {
            DB::transaction(function () use ($clave, $revocar): void {
                Rol::query()->where('codigo', 'administrador')->lockForUpdate()->firstOrFail();
                $cuenta = User::query()->lockForUpdate()->findOrFail($this->argument('id'));
                abort_unless(in_array('administrador', $cuenta->codigosDeAcceso(), true), 409);
                abort_if(User::query()->where('principal', true)->whereKeyNot($cuenta->id)->exists(), 409);
                abort_if(User::query()->where('email', 'admin@masterexpress.app')->whereKeyNot($cuenta->id)->exists(), 409);
                $cambioCorreo = $cuenta->email !== 'admin@masterexpress.app';
                $cuenta->forceFill(['name' => 'Ernesto', 'email' => 'admin@masterexpress.app', 'principal' => true, 'activa' => true]);
                if ($cambioCorreo) {
                    $cuenta->email_verified_at = null;
                }
                if ($clave !== null) {
                    $cuenta->password = $clave;
                }
                $revocar->ejecutar($cuenta);
                if ($clave !== null) {
                    abort_unless(\Illuminate\Support\Facades\Hash::check($clave, $cuenta->getAuthPassword()), 409);
                }
                EventoDeCuenta::create(['actor_id' => $cuenta->id, 'cuenta_id' => $cuenta->id, 'accion' => 'preparar-principal-qa']);
            }, 3);
        } catch (\Throwable) {
            $this->error('No se pudo preparar la cuenta. Revisa el ID, el rol, la unicidad del correo y la conexión QA. No se creó otra identidad.');

            return self::FAILURE;
        }
        $this->info('Identidad existente preservada y protegida. Sesiones anteriores revocadas. No se envió correo ni se verificó el buzón.');

        return self::SUCCESS;
    }
}
