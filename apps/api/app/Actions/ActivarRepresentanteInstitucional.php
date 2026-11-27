<?php

namespace App\Actions;

use App\Actions\Autenticacion\RevocarSesiones;
use App\Models\Rol;
use App\Models\SolicitudInstitucional;
use App\Models\User;
use App\Models\VinculoInstitucional;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

class ActivarRepresentanteInstitucional
{
    public function __construct(private readonly RevocarSesiones $revocar) {}

    public function ejecutar(#[\SensitiveParameter] array $datos): bool
    {
        $activada = DB::transaction(function () use ($datos): bool {
            $usuario = User::query()->where('email', $datos['email'])->lockForUpdate()->first();
            $solicitud = SolicitudInstitucional::query()->where('email', $datos['email'])
                ->where('requiere_activacion', true)->where('estado', SolicitudInstitucional::APROBADA)
                ->lockForUpdate()->first();
            $vinculo = $solicitud === null ? null : VinculoInstitucional::query()
                ->where('solicitud_id', $solicitud->id)->lockForUpdate()->first();
            if ($usuario === null || $solicitud === null || $vinculo === null
                || $solicitud->user_id !== $usuario->id || $solicitud->activada_en !== null
                || $vinculo->estado !== VinculoInstitucional::PENDIENTE || $vinculo->user_id !== $usuario->id) {
                return false;
            }

            $resultado = Password::broker()->reset($datos, function (User $cuenta, #[\SensitiveParameter] string $clave) use ($usuario, $solicitud, $vinculo): void {
                $cuenta->forceFill(['password' => Hash::make($clave)]);
                $this->revocar->ejecutar($cuenta);
                $usuario->roles()->syncWithoutDetaching([
                    Rol::query()->where('codigo', 'institucion')->sole(['id'])->id,
                ]);
                $vinculo->forceFill(['estado' => VinculoInstitucional::ACTIVO])->save();
                $solicitud->forceFill(['activada_en' => now()])->save();
            });

            return $resultado === Password::PASSWORD_RESET;
        }, 3);

        return $activada;
    }
}
