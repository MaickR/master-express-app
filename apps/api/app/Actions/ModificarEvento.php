<?php

namespace App\Actions;

use App\Models\Evento;
use App\Models\User;
use Closure;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ModificarEvento
{
    public function actualizar(User $actor, string $id, array $datos): Evento
    {
        return $this->conBloqueo($actor, $id, 'update', function (Evento $evento) use ($datos): void {
            $hoy = Evento::fechaOperativa();
            abort_unless(in_array($evento->estado($hoy), ['proximo', 'en_ejecucion'], true), 409, 'Solo se puede editar la programación activa.');
            abort_if($evento->revision !== (int) $datos['revision'], 409, 'Alguien actualizó el evento. Abre el formulario de nuevo para ver los cambios.');

            if (isset($datos['fecha']) && $datos['fecha'] < $hoy) {
                throw ValidationException::withMessages(['evento.fecha' => 'Selecciona hoy o una fecha futura en Colombia.']);
            }

            foreach ($datos['ceremonias'] ?? [] as $indice => $cambio) {
                $ceremonia = $evento->ceremonias()->find($cambio['id']);
                if (! $ceremonia) {
                    throw ValidationException::withMessages(["evento.ceremonias.{$indice}.id" => 'La ceremonia no pertenece al evento.']);
                }
                $ceremonia->fill(Arr::only($cambio, ['nombre', 'hora']))->saveOrFail();
            }

            $evento->fill(Arr::only($datos, ['fecha', 'lugar', 'graduandos_previstos', 'responsable', 'observaciones']));
            $evento->revision++;
            $evento->saveOrFail();
        });
    }

    public function cancelar(User $actor, string $id): Evento
    {
        return $this->conBloqueo($actor, $id, 'cancel', function (Evento $evento, User $actorVigente): void {
            if ($evento->cancelado_en !== null) {
                return;
            }
            abort_unless($evento->estado(Evento::fechaOperativa()) === 'proximo', 409, 'Solo se pueden cancelar eventos futuros.');
            $evento->forceFill(['cancelado_en' => now(), 'cancelado_por' => $actorVigente->id])->saveOrFail();
        });
    }

    private function conBloqueo(User $actor, string $id, string $permiso, Closure $operacion): Evento
    {
        return DB::transaction(function () use ($actor, $id, $permiso, $operacion): Evento {
            $actorVigente = User::query()->lockForUpdate()->find($actor->id);
            abort_if(! $actorVigente || $actorVigente->version_sesion !== $actor->version_sesion, 401, 'Tu sesión terminó.');
            $permisos = Gate::forUser($actorVigente);
            $permisos->authorize('viewAny', Evento::class);
            $evento = Evento::query()->lockForUpdate()->find($id);
            abort_unless($evento, 404, 'El evento no existe.');
            $permisos->authorize($permiso, $evento);
            $operacion($evento, $actorVigente);

            return $evento;
        }, 3);
    }
}
