<?php

namespace App\Jobs;

use App\Actions\Autenticacion\OrigenPublico;
use App\Actions\Autenticacion\TransporteDeCorreoSeguro;
use App\Models\SolicitudInstitucional;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use RuntimeException;
use Throwable;

class NotificarDecisionInstitucional implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(private readonly int $solicitudId) {}

    public function handle(TransporteDeCorreoSeguro $transporte, OrigenPublico $origen): void
    {
        $solicitud = $this->reclamar();
        if ($solicitud === null) {
            return;
        }

        try {
            if (! $transporte->permiteDestinatario($solicitud->email)) {
                $this->cerrar(SolicitudInstitucional::AVISO_FALLIDA, SolicitudInstitucional::FALLO_ENTORNO);

                return;
            }
            if (! $transporte->habilitar($solicitud->email)) {
                throw new RuntimeException;
            }

            $url = null;
            $vigencia = null;
            if ($solicitud->estado === SolicitudInstitucional::APROBADA && $solicitud->requiere_activacion && $solicitud->activada_en === null) {
                $usuario = User::query()->where('email', $solicitud->email)->first();
                if ($usuario === null) {
                    throw new RuntimeException;
                }
                $token = Password::broker()->createToken($usuario);
                $url = $origen->enlace('/activar-institucion', $solicitud->email, [
                    'token' => $token, 'email' => $solicitud->email,
                ]);
                $vigencia = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');
            }

            $aprobada = $solicitud->estado === SolicitudInstitucional::APROBADA;
            Mail::send(
                [
                    'html' => $aprobada ? 'correo.institucion-aprobada' : 'correo.institucion-rechazada',
                    'text' => $aprobada ? 'correo.institucion-aprobada-texto' : 'correo.institucion-rechazada-texto',
                ],
                [
                    'razonSocial' => $solicitud->razon_social,
                    'tipo' => $solicitud->tipo === 'colegio' ? 'Colegio' : 'Universidad',
                    'sede' => $solicitud->sede_nombre,
                    'url' => $url,
                    'vigencia' => $vigencia,
                    'motivo' => $solicitud->motivo_rechazo,
                ],
                fn (Message $mensaje) => $mensaje->to($solicitud->email)->subject(
                    $aprobada
                        ? 'Tu solicitud institucional fue aprobada'
                        : 'Tu solicitud institucional no fue aprobada',
                ),
            );
            $this->cerrar(SolicitudInstitucional::AVISO_ENVIADA, null);
        } catch (Throwable) {
            $this->cerrar(SolicitudInstitucional::AVISO_FALLIDA, SolicitudInstitucional::FALLO_ENTREGA);
            throw new RuntimeException(SolicitudInstitucional::FALLO_ENTREGA);
        }
    }

    private function reclamar(): ?SolicitudInstitucional
    {
        return DB::transaction(function (): ?SolicitudInstitucional {
            $solicitud = SolicitudInstitucional::query()->lockForUpdate()->find($this->solicitudId);
            if ($solicitud === null || ! in_array($solicitud->notificacion_estado, [
                SolicitudInstitucional::AVISO_PENDIENTE, SolicitudInstitucional::AVISO_FALLIDA,
            ], true)) {
                return null;
            }
            $solicitud->forceFill([
                'notificacion_estado' => SolicitudInstitucional::AVISO_ENVIANDO,
                'notificacion_detalle' => null,
            ])->save();

            return $solicitud;
        }, 3);
    }

    private function cerrar(string $estado, ?string $detalle): void
    {
        SolicitudInstitucional::query()->whereKey($this->solicitudId)->update([
            'notificacion_estado' => $estado,
            'notificacion_detalle' => $detalle,
            'updated_at' => now(),
        ]);
    }
}
