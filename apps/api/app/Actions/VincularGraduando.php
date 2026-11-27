<?php

namespace App\Actions;

use App\Models\AuditoriaVinculoGraduando;
use App\Models\Graduando;
use App\Models\User;
use App\Models\VinculoGraduando;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class VincularGraduando
{
    /**
     * Confirma por identificadores la relación entre una cuenta y un graduando operativo.
     * No compara correo, documento, nombre ni teléfono para conceder el acceso.
     */
    public function ejecutar(User $actor, int $graduandoId, int $cuentaId): VinculoGraduando
    {
        return DB::transaction(function () use ($actor, $graduandoId, $cuentaId): VinculoGraduando {
            $cuentas = $this->bloquearCuentas($actor->id, $cuentaId);
            $actorVigente = $this->actorVigente($actor, $cuentas->get($actor->id));
            Gate::forUser($actorVigente)->authorize('create', VinculoGraduando::class);

            $graduando = Graduando::query()->lockForUpdate()->find($graduandoId);
            abort_unless($graduando, 404, 'El graduando no existe.');
            $cuenta = $cuentas->get($cuentaId);
            abort_unless($cuenta instanceof User, 404, 'La cuenta no existe.');

            return $this->confirmar($actorVigente, $graduando, $cuenta);
        }, 3);
    }

    /**
     * Conserva la fila y retira el acceso. No mueve inscripciones, ceremonias ni pagos.
     */
    public function anular(User $actor, int $vinculoId, string $motivo): VinculoGraduando
    {
        return DB::transaction(function () use ($actor, $vinculoId, $motivo): VinculoGraduando {
            $cuentas = $this->bloquearCuentas($actor->id, $actor->id);
            $actorVigente = $this->actorVigente($actor, $cuentas->get($actor->id));
            Gate::forUser($actorVigente)->authorize('corregir', VinculoGraduando::class);
            $vinculo = $this->vinculoActivo($vinculoId);

            return $this->retirar($actorVigente, $vinculo, $motivo);
        }, 3);
    }

    /**
     * Anula el acceso anterior y confirma otra cuenta, en una sola transacción.
     * Las inscripciones permanecen en su ceremonia.
     */
    public function corregir(User $actor, int $vinculoId, int $nuevaCuentaId, string $motivo): VinculoGraduando
    {
        return DB::transaction(function () use ($actor, $vinculoId, $nuevaCuentaId, $motivo): VinculoGraduando {
            $pista = VinculoGraduando::query()->find($vinculoId);
            abort_unless($pista, 404, 'La vinculación no existe.');
            $cuentas = $this->bloquearUsuarios([$actor->id, $nuevaCuentaId, $pista->user_id]);
            $actorVigente = $this->actorVigente($actor, $cuentas->get($actor->id));
            Gate::forUser($actorVigente)->authorize('corregir', VinculoGraduando::class);
            $previo = $this->vinculoActivo($vinculoId);
            abort_if($previo->user_id === $nuevaCuentaId, 409, 'La cuenta nueva es la misma. La vinculación no cambió.');
            $cuenta = $cuentas->get($nuevaCuentaId);
            abort_unless($cuenta instanceof User, 404, 'La cuenta no existe.');
            $graduando = Graduando::query()->lockForUpdate()->find($previo->graduando_id);
            abort_unless($graduando, 404, 'El graduando no existe.');
            $this->retirar($actorVigente, $previo, $motivo);

            return $this->confirmar($actorVigente, $graduando, $cuenta);
        }, 3);
    }

    private function confirmar(User $actor, Graduando $graduando, User $cuenta): VinculoGraduando
    {
        $this->exigirCuentaElegible($cuenta);
        $historico = VinculoGraduando::query()
            ->where('user_id', $cuenta->id)
            ->where('graduando_id', $graduando->id)
            ->lockForUpdate()
            ->first();
        abort_if(
            $historico?->estado === VinculoGraduando::ACTIVO,
            409,
            'Esta cuenta ya está vinculada con este graduando.',
        );
        abort_if(
            $historico instanceof VinculoGraduando,
            409,
            'Esta vinculación ya fue anulada y su evidencia se conserva. No se crea otra fila para el mismo par.',
        );

        $activos = VinculoGraduando::query()
            ->where('estado', VinculoGraduando::ACTIVO)
            ->where(fn ($consulta) => $consulta->where('user_id', $cuenta->id)->orWhere('graduando_id', $graduando->id))
            ->lockForUpdate()
            ->get();
        // * Hasta que Ernesto defina la cardinalidad, un segundo acceso activo queda sin conceder.
        abort_if(
            $activos->isNotEmpty(),
            409,
            'La cuenta o el graduando ya tiene otra vinculación. No se concedió acceso y la relación queda pendiente de revisión.',
        );

        $vinculo = new VinculoGraduando;
        $vinculo->forceFill([
            'user_id' => $cuenta->id,
            'graduando_id' => $graduando->id,
            'decidido_por' => $actor->id,
            'decidida_en' => now(),
            'estado' => VinculoGraduando::ACTIVO,
        ]);

        try {
            $vinculo->save();
        } catch (UniqueConstraintViolationException) {
            abort(409, 'Esta cuenta ya está vinculada con este graduando.');
        }
        $this->auditar($vinculo, $actor, AuditoriaVinculoGraduando::CONFIRMADO, null);

        return $vinculo->setRelation('cuenta', $cuenta)->setRelation('graduando', $graduando)
            ->setRelation('administrador', $actor);
    }

    private function retirar(User $actor, VinculoGraduando $vinculo, string $motivo): VinculoGraduando
    {
        $vinculo->forceFill([
            'estado' => VinculoGraduando::ANULADO,
            'motivo_anulacion' => $motivo,
            'anulado_por' => $actor->id,
            'anulado_en' => now(),
        ])->save();
        $this->auditar($vinculo, $actor, AuditoriaVinculoGraduando::ANULADO, $motivo);

        return $vinculo;
    }

    private function vinculoActivo(int $vinculoId): VinculoGraduando
    {
        $vinculo = VinculoGraduando::query()->lockForUpdate()->find($vinculoId);
        abort_unless($vinculo, 404, 'La vinculación no existe.');
        abort_unless($vinculo->estado === VinculoGraduando::ACTIVO, 409, 'La vinculación ya está anulada.');

        return $vinculo;
    }

    private function auditar(VinculoGraduando $vinculo, User $actor, string $accion, ?string $motivo): void
    {
        $evento = new AuditoriaVinculoGraduando;
        $evento->forceFill([
            'vinculo_id' => $vinculo->id,
            'accion' => $accion,
            'actor_id' => $actor->id,
            'user_id' => $vinculo->user_id,
            'graduando_id' => $vinculo->graduando_id,
            'motivo' => $motivo,
            'created_at' => now(),
        ])->save();
    }

    private function actorVigente(User $actor, mixed $bloqueado): User
    {
        abort_if(
            ! $bloqueado instanceof User || ! $bloqueado->activa || $bloqueado->version_sesion !== $actor->version_sesion,
            401,
            'Tu sesión terminó.',
        );

        return $bloqueado;
    }

    private function bloquearCuentas(int $actorId, int $cuentaId): Collection
    {
        return $this->bloquearUsuarios([$actorId, $cuentaId]);
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, User|null>
     */
    private function bloquearUsuarios(array $ids): Collection
    {
        $ids = array_values(array_unique($ids));
        sort($ids);

        return collect($ids)->mapWithKeys(function (int $id): array {
            return [$id => User::query()->lockForUpdate()->find($id)];
        });
    }

    private function exigirCuentaElegible(User $cuenta): void
    {
        abort_unless($cuenta->activa, 422, 'La cuenta de Graduando no está activa.');
        abort_unless($cuenta->email_verified_at !== null, 422, 'La cuenta de Graduando no tiene el correo verificado.');
        if (User::query()->conAccesoEfectivoDeGraduando()->whereKey($cuenta->id)->exists()) {
            return;
        }

        $tieneRolGraduando = $cuenta->roles()->where('codigo', 'graduando')->exists();
        abort(422, $tieneRolGraduando
            ? 'La cuenta no puede acceder al portal de Graduandos.'
            : 'La cuenta no tiene el rol Graduando.');
    }
}
