<?php

namespace App\Policies;

use App\Models\Evento;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class EventoPolicy
{
    public function viewAny(User $actor): Response
    {
        $ensayo = app()->environment('testing') && DB::getDefaultConnection() === 'mysql_pruebas';

        if ((! $ensayo && ! config('eventos.habilitados'))
            || ! $actor->activa || $actor->cambio_clave_pendiente
            || ! in_array('administrador', $actor->codigosDeAcceso(), true)) {
            return Response::deny('La cuenta no tiene acceso a la programación de eventos.');
        }

        return Schema::hasColumn('eventos', 'revision')
            ? Response::allow()
            : Response::denyWithStatus(503, 'La programación de eventos todavía no está disponible.');
    }

    public function view(User $actor, Evento $evento): Response
    {
        return $this->viewAny($actor);
    }

    public function create(User $actor): Response
    {
        return $this->viewAny($actor);
    }

    public function update(User $actor, Evento $evento): Response
    {
        return $this->view($actor, $evento);
    }

    public function cancel(User $actor, Evento $evento): Response
    {
        return $this->update($actor, $evento);
    }
}
