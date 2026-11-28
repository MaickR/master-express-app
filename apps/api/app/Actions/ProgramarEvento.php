<?php

namespace App\Actions;

use App\Models\Evento;
use App\Models\Institucion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ProgramarEvento
{
    public function ejecutar(User $actor, array $entrada): Evento
    {
        $institucionId = (int) $entrada['institucion_id'];
        $sedeId = (int) $entrada['sede_id'];
        $cantidad = (int) $entrada['numero_ceremonias'];
        $operationId = strtolower($entrada['operation_id']);
        $programacion = ['fecha' => $entrada['fecha'], 'lugar' => $entrada['lugar'] ?? null];
        $huella = hash('sha256', json_encode([$institucionId, $sedeId, $programacion, $cantidad], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($actor, $institucionId, $sedeId, $cantidad, $operationId, $programacion, $huella): Evento {
            // * Serializa los reintentos del actor y coordina el alta con la revocación de su sesión.
            $actorVigente = User::query()->lockForUpdate()->find($actor->id);
            abort_if(! $actorVigente || $actorVigente->version_sesion !== $actor->version_sesion, 401, 'Tu sesión terminó.');
            Gate::forUser($actorVigente)->authorize('create', Evento::class);

            $previo = Evento::query()->where('actor_id', $actorVigente->id)
                ->where('operation_id', $operationId)->first();

            if ($previo) {
                Gate::forUser($actorVigente)->authorize('view', $previo);
                abort_unless(hash_equals($previo->huella_solicitud, $huella), 409, 'El identificador ya corresponde a otra solicitud.');

                return $previo;
            }

            $institucion = Institucion::query()->find($institucionId);
            if (! $institucion) {
                throw ValidationException::withMessages(['evento.institucion_id' => 'La institución seleccionada no existe.']);
            }

            $sede = $institucion->sedes()->sharedLock()->find($sedeId);
            if (! $sede) {
                throw ValidationException::withMessages(['evento.sede_id' => 'Selecciona una sede de la institución elegida.']);
            }

            $evento = new Evento($programacion);
            $evento->forceFill([
                'actor_id' => $actorVigente->id,
                'operation_id' => $operationId,
                'huella_solicitud' => $huella,
            ]);
            $evento->institucion()->associate($institucion);
            $evento->sede()->associate($sede);
            throw_unless($evento->save(), RuntimeException::class, 'No se pudo guardar el evento.');

            foreach (range(1, $cantidad) as $orden) {
                $ceremonia = $evento->ceremonias()->make(['nombre' => "Ceremonia {$orden}", 'orden' => $orden]);
                throw_unless($ceremonia->save(), RuntimeException::class, 'No se pudo guardar la ceremonia.');
            }

            return $evento;
        }, 3);
    }
}
