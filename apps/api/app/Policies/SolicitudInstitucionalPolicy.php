<?php

namespace App\Policies;

use App\Models\SolicitudInstitucional;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class SolicitudInstitucionalPolicy
{
    public function viewAny(User $actor): Response
    {
        return $this->administrador($actor);
    }

    public function view(User $actor, SolicitudInstitucional $solicitud): Response
    {
        return $this->administrador($actor);
    }

    public function decidir(User $actor): Response
    {
        return $this->administrador($actor);
    }

    private function administrador(User $actor): Response
    {
        return $actor->activa && in_array('administrador', $actor->codigosDeAcceso(), true)
            ? Response::allow()
            : Response::deny('Tu cuenta no puede decidir solicitudes institucionales.');
    }
}
