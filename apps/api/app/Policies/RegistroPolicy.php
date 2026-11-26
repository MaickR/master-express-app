<?php

namespace App\Policies;

use App\Models\Registro;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class RegistroPolicy
{
    public function viewAny(User $actor): Response
    {
        return $this->rolesDelEnsayo($actor) !== []
            ? Response::allow()
            : Response::deny('La cuenta no tiene acceso a las inscripciones en Laravel.');
    }

    public function view(User $actor, Registro $registro): Response
    {
        $roles = $this->rolesDelEnsayo($actor);

        return in_array('administrador', $roles, true)
            || (in_array('colaborador', $roles, true) && $registro->actor_id === $actor->id)
            ? Response::allow()
            : Response::denyAsNotFound('El registro no existe en el ámbito de la cuenta.');
    }

    public function create(User $actor): Response
    {
        return in_array('colaborador', $this->rolesDelEnsayo($actor), true)
            ? Response::allow()
            : Response::deny('La cuenta no puede inscribir graduandos en Laravel.');
    }

    /** @return Builder<Registro> */
    public function consulta(User $actor): Builder
    {
        Gate::forUser($actor)->authorize('viewAny', Registro::class);

        $consulta = Registro::query();

        return in_array('administrador', $this->rolesDelEnsayo($actor), true)
            ? $consulta
            : $consulta->where('actor_id', $actor->id);
    }

    /** @return list<string> */
    private function rolesDelEnsayo(User $actor): array
    {
        // * El ámbito provisional abarca exclusivamente los datos ficticios de la conexión de QA.
        return app()->environment('testing')
            && DB::getDefaultConnection() === 'mysql_pruebas'
            && $actor->activa
            ? $actor->codigosDeAcceso()
            : [];
    }
}
