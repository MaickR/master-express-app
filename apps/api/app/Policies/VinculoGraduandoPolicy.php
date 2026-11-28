<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class VinculoGraduandoPolicy
{
    public function viewAny(User $actor): Response
    {
        return $this->administrador($actor);
    }

    public function create(User $actor): Response
    {
        return $this->administrador($actor);
    }

    public function corregir(User $actor): Response
    {
        return $actor->activa && in_array('administrador', $actor->codigosDeAcceso(), true)
            ? Response::allow()
            : Response::deny('Tu cuenta no puede corregir vinculaciones de graduandos.');
    }

    private function administrador(User $actor): Response
    {
        return $actor->activa && in_array('administrador', $actor->codigosDeAcceso(), true)
            ? Response::allow()
            : Response::deny('Tu cuenta no puede vincular graduandos.');
    }
}
