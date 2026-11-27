<?php

namespace App\Jobs;

use App\Actions\Autenticacion\TransporteDeCorreoSeguro;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use RuntimeException;
use Throwable;

class EnviarEnlaceDeRecuperacion implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable, Queueable;

    public int $tries = 1;

    public function __construct(private readonly string $correo) {}

    public function handle(): void
    {
        $transporte = app(TransporteDeCorreoSeguro::class);
        if (! $transporte->permiteDestinatario($this->correo)) {
            return;
        }

        try {
            $transporteHabilitado = $transporte->habilitar($this->correo);
        } catch (Throwable) {
            $transporteHabilitado = false;
        }
        if (! $transporteHabilitado) {
            throw new RuntimeException('La configuración del correo de recuperación es inválida.');
        }

        $errorSeguro = 'No se pudo preparar el enlace de recuperación.';
        try {
            $entrega = DB::transaction(function (): ?array {
                $usuario = User::query()->where('email', $this->correo)->lockForUpdate()->first();
                if (! $usuario?->puedeRecuperarContrasena()) {
                    return null;
                }

                $resultado = Password::broker()->sendResetLink(
                    ['email' => $this->correo],
                    fn (User $cuenta, #[\SensitiveParameter] string $token): array => [$cuenta, $token],
                );

                return is_array($resultado) ? $resultado : null;
            }, 3);

            if ($entrega !== null) {
                [$usuario, $token] = $entrega;
                $errorSeguro = 'El transporte de correo de recuperación no confirmó la entrega.';
                $usuario->sendPasswordResetNotification($token);
            }
        } catch (Throwable) {
            // Laravel persiste la excepción completa. La causa puede contener credenciales y el enlace.
            throw new RuntimeException($errorSeguro);
        }
    }
}
