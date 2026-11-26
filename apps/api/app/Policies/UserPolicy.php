<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class UserPolicy
{
    public function gestionarCuentas(User $actor): Response
    {
        return $actor->activa && in_array('administrador', $actor->codigosDeAcceso(), true)
            ? Response::allow()
            : Response::deny('Tu cuenta no puede gestionar cuentas internas.');
    }

    public function operarCuenta(User $actor, User $cuenta): Response
    {
        $permiso = $this->gestionarCuentas($actor);

        return $permiso->denied() || $cuenta->codigosDeAcceso() !== []
            ? $permiso
            : Response::denyAsNotFound('La cuenta interna no existe.');
    }
}
