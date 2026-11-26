<?php

namespace App\Actions;

use App\Models\Ceremonia;
use App\Models\Graduando;
use App\Models\Registro;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class InscribirGraduando
{
    public function ejecutar(User $actor, string $ceremoniaId, array $entrada): Registro
    {
        $operationId = strtolower($entrada['operation_id']);
        $eventoId = (int) $entrada['evento_id'];
        $graduandoId = (int) $entrada['graduando_id'];
        $programa = $entrada['programa_academico'] ?? null;
        $huella = hash('sha256', json_encode([$ceremoniaId, $eventoId, $graduandoId, $programa], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($actor, $ceremoniaId, $operationId, $eventoId, $graduandoId, $programa, $huella): Registro {
            // * Coordina los reintentos y las revocaciones de sesión del mismo actor.
            $actorVigente = User::query()->lockForUpdate()->find($actor->id);
            abort_if(! $actorVigente || ! $actorVigente->activa || $actorVigente->version_sesion !== $actor->version_sesion, 401, 'Tu sesión terminó.');
            $permisos = Gate::forUser($actorVigente);
            $permisos->authorize('create', Registro::class);

            $previo = Registro::query()->where('actor_id', $actorVigente->id)
                ->where('operation_id', $operationId)->first();
            if ($previo) {
                $permisos->authorize('view', $previo);
                abort_unless(hash_equals($previo->huella_solicitud, $huella), 409, 'El identificador ya corresponde a otra solicitud.');
            }

            $ceremonia = Ceremonia::query()->where('evento_id', $eventoId)->sharedLock()->find($ceremoniaId);
            abort_unless($ceremonia, 404, 'La ceremonia no existe en este evento.');

            if ($previo) {
                return $previo;
            }

            $graduando = Graduando::query()->sharedLock()->find($graduandoId);
            if (! $graduando) {
                throw ValidationException::withMessages(['registro.graduando_id' => 'El graduando seleccionado no existe.']);
            }

            $registro = new Registro(['programa_academico' => $programa]);
            $registro->forceFill(['operation_id' => $operationId, 'huella_solicitud' => $huella]);
            $registro->actor()->associate($actorVigente);
            $registro->ceremonia()->associate($ceremonia);
            $registro->graduando()->associate($graduando);

            try {
                throw_unless($registro->save(), RuntimeException::class, 'No se pudo guardar la inscripción.');
            } catch (UniqueConstraintViolationException) {
                abort(409, 'La participación ya tiene una inscripción.');
            }

            return $registro;
        }, 3);
    }
}
