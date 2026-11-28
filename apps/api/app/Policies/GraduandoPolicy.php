<?php

namespace App\Policies;

use App\Models\Graduando;
use App\Models\User;
use App\Models\VinculoGraduando;
use App\Models\VinculoInstitucional;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;

class GraduandoPolicy
{
    public function disponible(User $actor): bool
    {
        return $actor->activa && ! $actor->cambio_clave_pendiente
            && ((app()->environment('testing') && DB::getDefaultConnection() === 'mysql_pruebas') || config('graduandos.habilitados'));
    }

    public function viewAny(User $actor): bool
    {
        return $this->disponible($actor) && Schema::hasColumn('graduandos', 'revision')
            && array_intersect($actor->codigosDeSesion(), ['administrador', 'colaborador', 'institucion', 'graduando']) !== [];
    }

    public function rolDeGestion(User $actor): ?string
    {
        if (! $this->viewAny($actor)) {
            return null;
        }
        $roles = $actor->codigosDeAcceso();

        return in_array('administrador', $roles, true) ? 'administrador'
            : (in_array('colaborador', $roles, true) ? 'colaborador' : null);
    }

    public function create(User $actor): bool
    {
        return $this->rolDeGestion($actor) !== null;
    }

    public function permiteEditar(User $actor, Graduando $graduando, ?string $rol): bool
    {
        return $rol === 'administrador' || ($rol === 'colaborador' && $graduando->creado_por === $actor->id);
    }

    public function update(User $actor, Graduando $graduando): bool
    {
        return $this->permiteEditar($actor, $graduando, $this->rolDeGestion($actor));
    }

    public function view(User $actor, Graduando $graduando): bool
    {
        return $this->consulta($actor)->whereKey($graduando->id)->exists();
    }

    /** @return Builder<Graduando> */
    public function consulta(User $actor): Builder
    {
        Gate::forUser($actor)->authorize('viewAny', Graduando::class);
        $consulta = Graduando::query();
        $roles = $actor->codigosDeSesion();
        if (in_array('administrador', $roles, true)) {
            return $consulta;
        }
        if (in_array('colaborador', $roles, true)) {
            return $consulta->where('creado_por', $actor->id);
        }

        return $consulta->where(function (Builder $ambito) use ($actor, $roles): void {
            $ambito->whereRaw('1 = 0');
            if (in_array('graduando', $roles, true)) {
                $ambito->orWhereHas('vinculos', fn (Builder $vinculos) => $vinculos
                    ->where('user_id', $actor->id)->where('estado', VinculoGraduando::ACTIVO));
            }
            if (in_array('institucion', $roles, true)) {
                $ambito->orWhereHas('registros.ceremonia.evento', function (Builder $eventos) use ($actor): void {
                    $this->limitarEventosInstitucionales($eventos, $actor);
                });
            }
        });
    }

    public function limitarEventosInstitucionales(Builder $eventos, User $actor): void
    {
        $eventos->whereExists(function ($vinculos) use ($actor): void {
            $vinculos->selectRaw('1')->from('vinculos_institucionales')
                ->join('sedes', 'sedes.id', '=', 'vinculos_institucionales.sede_id')
                ->where('vinculos_institucionales.user_id', $actor->id)
                ->where('vinculos_institucionales.estado', VinculoInstitucional::ACTIVO)
                ->whereColumn('sedes.institucion_id', 'vinculos_institucionales.institucion_id')
                ->whereColumn('eventos.institucion_id', 'vinculos_institucionales.institucion_id')
                ->whereColumn('eventos.sede_id', 'vinculos_institucionales.sede_id');
        });
    }
}
