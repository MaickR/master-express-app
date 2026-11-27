<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class VinculoInstitucionalPolicy
{
    public function viewAny(User $usuario): Response
    {
        return $usuario->accesoInstitucionalVerificado()
            ? Response::allow()
            : Response::deny('La cuenta no tiene un acceso institucional activo.');
    }
}
