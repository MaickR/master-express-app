<?php

namespace App\Policies;

use App\Models\Registro;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;

class RegistroPolicy
{
    public function viewAny(User $actor): Response
    {
        return app(GraduandoPolicy::class)->viewAny($actor)
            ? Response::allow() : Response::deny('La cuenta no tiene acceso a las inscripciones.');
    }

    public function view(User $actor, Registro $registro): Response
    {
        return $this->consulta($actor)->whereKey($registro->id)->exists()
            ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $actor): Response
    {
        return app(GraduandoPolicy::class)->create($actor)
            ? Response::allow() : Response::deny('La cuenta no puede inscribir graduandos.');
    }

    /** @return Builder<Registro> */
    public function consulta(User $actor): Builder
    {
        Gate::forUser($actor)->authorize('viewAny', Registro::class);

        $consulta = Registro::query();
        $roles = $actor->codigosDeSesion();
        if (in_array('administrador', $roles, true)) {
            return $consulta;
        }
        if (in_array('colaborador', $roles, true)) {
            return $consulta->where('actor_id', $actor->id);
        }

        return $consulta->where(function (Builder $ambito) use ($actor, $roles): void {
            $ambito->whereRaw('1 = 0');
            if (in_array('graduando', $roles, true)) {
                $ambito->orWhereHas('graduando.vinculos', fn ($vinculos) => $vinculos->where('user_id', $actor->id)->where('estado', 'activo'));
            }
            if (in_array('institucion', $roles, true)) {
                $ambito->orWhereHas('ceremonia.evento', function ($eventos) use ($actor): void {
                    app(GraduandoPolicy::class)->limitarEventosInstitucionales($eventos, $actor);
                });
            }
        });
    }
}
