<?php

namespace App\Actions;

use App\Models\Graduando;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class GuardarGraduandoOperativo
{
    public function ejecutar(User $actor, array $datos, ?int $id = null): Graduando
    {
        try {
            return DB::transaction(function () use ($actor, $datos, $id): Graduando {
                $vigente = User::query()->lockForUpdate()->find($actor->id);
                abort_unless($vigente && $vigente->activa && $vigente->version_sesion === $actor->version_sesion, 401);
                Gate::forUser($vigente)->authorize('create', Graduando::class);
                $campos = [];
                foreach (['nombre_completo', 'correo', 'telefono', 'tipo_documento', 'numero_documento'] as $campo) {
                    $campos[$campo] = $datos[$campo] ?? null;
                }
                $huella = hash('sha256', json_encode($campos, JSON_THROW_ON_ERROR));
                if ($id === null) {
                    $operacion = strtolower($datos['operation_id']);
                    $previo = Graduando::query()->where('creado_por', $vigente->id)->where('operation_id', $operacion)->first();
                    if ($previo) {
                        abort_unless(hash_equals($previo->huella_solicitud, $huella), 409, 'La operación ya corresponde a otros datos.');

                        return $previo;
                    }
                    $graduando = new Graduando;
                    $graduando->forceFill(['creado_por' => $vigente->id, 'operation_id' => $operacion, 'huella_solicitud' => $huella]);
                } else {
                    $graduando = Graduando::query()->lockForUpdate()->findOrFail($id);
                    abort_unless(Gate::forUser($vigente)->allows('update', $graduando), 404);
                    abort_unless($graduando->revision === (int) $datos['revision'], 409, 'Este perfil cambió. Actualiza antes de guardar.');
                    $graduando->revision++;
                }
                $graduando->forceFill($campos)->saveOrFail();

                return $graduando->refresh();
            }, 3);
        } catch (UniqueConstraintViolationException) {
            abort(409, 'El documento ya está registrado. Revisa la identidad antes de continuar.');
        }
    }
}
