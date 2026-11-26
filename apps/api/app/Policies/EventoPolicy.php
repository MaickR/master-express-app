<?php

namespace App\Policies;

use App\Models\Evento;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\DB;

class EventoPolicy
{
    public function viewAny(User $actor): Response
    {
        // * El ensayo usa datos ficticios. El alcance institucional y las concesiones reales siguen pendientes.
        return app()->environment('testing')
            && DB::getDefaultConnection() === 'mysql_pruebas'
            && $actor->activa
            && in_array('administrador', $actor->codigosDeAcceso(), true)
            ? Response::allow()
            : Response::deny('La cuenta no tiene acceso a la programación en Laravel.');
    }

    public function view(User $actor, Evento $evento): Response
    {
        return $this->viewAny($actor);
    }

    public function create(User $actor): Response
    {
        return $this->viewAny($actor);
    }
}
