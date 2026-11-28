<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class UserPolicy
{
    public function editarPerfil(User $actor): Response
    {
        return $actor->activa && $actor->codigosDeAcceso() !== []
            ? Response::allow() : Response::deny();
    }

    public function gestionarCuentas(User $actor): Response
    {
        return $actor->activa && in_array('administrador', $actor->codigosDeAcceso(), true)
            ? Response::allow()
            : Response::deny('Tu cuenta no puede gestionar cuentas internas.');
    }

    public function operarCuenta(User $actor, User $cuenta): Response
    {
        $permiso = $this->gestionarCuentas($actor);

        if ($permiso->allowed() && $cuenta->roles()->whereNotIn('codigo', User::ROLES_INTERNOS)->exists()) {
            return Response::denyAsNotFound('La cuenta externa no se gestiona aquí.');
        }

        if ($permiso->allowed() && $cuenta->principal && ! $actor->is($cuenta)) {
            return Response::deny('La cuenta principal está protegida.');
        }

        return $permiso->denied() || $cuenta->esInterna()
            ? $permiso
            : Response::denyAsNotFound('La cuenta interna no existe.');
    }
}
