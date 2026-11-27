<?php

namespace App\Actions;

use App\Actions\Autenticacion\DesafioDeCorreo;
use App\Jobs\NotificarDecisionInstitucional;
use App\Models\Institucion;
use App\Models\Rol;
use App\Models\Sede;
use App\Models\SolicitudInstitucional;
use App\Models\User;
use App\Models\VinculoInstitucional;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Throwable;

class DecidirSolicitudInstitucional
{
    public function __construct(private readonly DesafioDeCorreo $desafios) {}

    public function aprobar(User $actor, int $id): SolicitudInstitucional
    {
        $solicitud = $this->decidir($actor, $id, function (User $responsable, SolicitudInstitucional $solicitud): void {
            abort_unless($solicitud->estado === SolicitudInstitucional::PENDIENTE, 409, 'La solicitud ya tiene una decisión.');

            $titular = $this->titular($solicitud);
            try {
                $institucion = new Institucion;
                $institucion->forceFill([
                    'nombre' => $solicitud->razon_social,
                    'tipo' => $solicitud->tipo,
                    'nit' => $solicitud->nit,
                ])->save();
            } catch (UniqueConstraintViolationException) {
                abort(409, 'Ya existe una institución con ese NIT. La solicitud sigue pendiente y no se vinculó.');
            }

            $sede = new Sede;
            $sede->forceFill([
                'institucion_id' => $institucion->id,
                'nombre' => $solicitud->sede_nombre,
            ])->save();

            if (! $solicitud->requiere_activacion) {
                $titular->roles()->syncWithoutDetaching([
                    Rol::query()->where('codigo', 'institucion')->sole(['id'])->id,
                ]);
            }

            $vinculo = new VinculoInstitucional;
            $vinculo->forceFill([
                'user_id' => $titular->id,
                'institucion_id' => $institucion->id,
                'sede_id' => $sede->id,
                'solicitud_id' => $solicitud->id,
                'estado' => $solicitud->requiere_activacion ? VinculoInstitucional::PENDIENTE : VinculoInstitucional::ACTIVO,
            ])->save();

            $solicitud->forceFill([
                'estado' => SolicitudInstitucional::APROBADA,
                'user_id' => $titular->id,
                'decidida_por' => $responsable->id,
                'decidida_en' => now(),
                'institucion_id' => $institucion->id,
                'sede_id' => $sede->id,
                'activada_en' => $solicitud->requiere_activacion ? null : now(),
                'motivo_rechazo' => null,
                'notificacion_estado' => SolicitudInstitucional::AVISO_PENDIENTE,
                'notificacion_detalle' => null,
            ])->save();
        });
        $this->encolar($solicitud->id);

        return $solicitud->refresh();
    }

    public function rechazar(User $actor, int $id, string $motivo): SolicitudInstitucional
    {
        $solicitud = $this->decidir($actor, $id, function (User $responsable, SolicitudInstitucional $solicitud) use ($motivo): void {
            abort_unless(
                $solicitud->estado === SolicitudInstitucional::PENDIENTE && $solicitud->activada_en === null,
                409,
                'La solicitud ya tiene una decisión y no puede rechazarse.',
            );
            $solicitud->forceFill([
                'estado' => SolicitudInstitucional::RECHAZADA,
                'reserva_correo' => null,
                'decidida_por' => $responsable->id,
                'decidida_en' => now(),
                'motivo_rechazo' => $motivo,
                'notificacion_estado' => SolicitudInstitucional::AVISO_PENDIENTE,
                'notificacion_detalle' => null,
            ])->save();
        });
        $this->encolar($solicitud->id);

        return $solicitud->refresh();
    }

    public function reintentar(User $actor, int $id): void
    {
        $this->desafios->exigirColaDeIdentidad();
        DB::transaction(function () use ($actor, $id): void {
            $this->responsable($actor);
            $solicitud = SolicitudInstitucional::query()->lockForUpdate()->find($id);
            abort_unless($solicitud, 404, 'La solicitud no existe.');
            abort_unless(
                in_array($solicitud->estado, [SolicitudInstitucional::APROBADA, SolicitudInstitucional::RECHAZADA], true),
                409,
                'La solicitud todavía no tiene una decisión.',
            );
            abort_if($solicitud->notificacion_estado === SolicitudInstitucional::AVISO_ENVIADA, 409, 'La notificación ya fue entregada.');
            abort_if($solicitud->notificacion_estado === SolicitudInstitucional::AVISO_ENVIANDO, 409, 'La notificación está en curso.');
            abort_unless(
                in_array($solicitud->notificacion_estado, [SolicitudInstitucional::AVISO_PENDIENTE, SolicitudInstitucional::AVISO_FALLIDA], true),
                409,
                'La notificación no admite reintento.',
            );
            if ($solicitud->notificacion_estado === SolicitudInstitucional::AVISO_FALLIDA) {
                $solicitud->forceFill([
                    'notificacion_estado' => SolicitudInstitucional::AVISO_PENDIENTE,
                    'notificacion_detalle' => null,
                ])->save();
            }
        }, 3);
        $this->encolar($id);
    }

    private function decidir(User $actor, int $id, \Closure $cambio): SolicitudInstitucional
    {
        $this->desafios->exigirColaDeIdentidad();

        return DB::transaction(function () use ($actor, $id, $cambio): SolicitudInstitucional {
            $responsable = $this->responsable($actor);
            $solicitud = SolicitudInstitucional::query()->lockForUpdate()->find($id);
            abort_unless($solicitud, 404, 'La solicitud no existe.');
            $cambio($responsable, $solicitud);

            return $solicitud;
        }, 3);
    }

    private function responsable(User $actor): User
    {
        $vigente = User::query()->lockForUpdate()->find($actor->id);
        abort_unless($vigente, 401, 'Tu sesión terminó.');
        abort_if($vigente->version_sesion !== $actor->version_sesion, 401, 'Tu sesión terminó.');
        Gate::forUser($vigente)->authorize('decidir', SolicitudInstitucional::class);

        return $vigente;
    }

    private function titular(SolicitudInstitucional $solicitud): User
    {
        if ($solicitud->user_id !== null) {
            $titular = User::query()->lockForUpdate()->find($solicitud->user_id);
            abort_unless(
                $titular && $titular->email === $solicitud->email && $titular->activa && $titular->email_verified_at !== null,
                409,
                'La cuenta de la solicitud ya no puede recibir la representación. La solicitud sigue pendiente.',
            );

            return $titular;
        }

        $ocupada = User::query()->where('email', $solicitud->email)->lockForUpdate()->first();
        abort_if($ocupada, 409, 'El correo ya tiene una cuenta. La solicitud sigue pendiente y no se vinculó.');

        try {
            $titular = new User;
            $titular->forceFill([
                'name' => $solicitud->representante_nombre,
                'nombres' => $solicitud->representante_nombre,
                'email' => $solicitud->email,
                'email_verified_at' => $solicitud->correo_verificado_en,
                'telefono' => $solicitud->telefono,
                'password' => Str::password(40),
                'activa' => true,
            ])->save();
        } catch (UniqueConstraintViolationException) {
            abort(409, 'El correo ya tiene una cuenta. La solicitud sigue pendiente y no se vinculó.');
        }

        return $titular;
    }

    private function encolar(int $id): void
    {
        try {
            Bus::dispatch((new NotificarDecisionInstitucional($id))
                ->onConnection('database')->onQueue('registro-institucion'));
        } catch (Throwable) {
            // La decisión ya quedó confirmada. El estado pendiente admite un reintento.
        }
    }
}
