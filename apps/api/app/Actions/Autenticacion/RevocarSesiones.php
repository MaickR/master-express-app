<?php

namespace App\Actions\Autenticacion;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class RevocarSesiones
{
    // La operación llamante mantiene bloqueada la cuenta en una transacción.
    public function ejecutar(User $usuario): void
    {
        $usuario->forceFill([
            'remember_token' => null,
            'version_sesion' => $usuario->version_sesion + 1,
        ])->saveOrFail();

        DB::connection(config('session.connection'))
            ->table(config('session.table'))->where('user_id', $usuario->getKey())->delete();
    }
}
