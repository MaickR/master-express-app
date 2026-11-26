<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;
use Throwable;

class EnviarEnlaceDeRecuperacion implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable, Queueable;

    public int $tries = 1;

    public function __construct(private readonly string $correo) {}

    public function handle(): void
    {
        $produccion = app()->isProduction();
        if (! $produccion && ! Str::endsWith($this->correo, '@example.invalid')) {
            return;
        }

        try {
            $transporteHabilitado = $this->configurarTransporte($produccion);
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
                if ($usuario === null || $usuario->codigosDeAcceso() === []) {
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

    private function configurarTransporte(bool $produccion): bool
    {
        $mailer = config('mail.default');
        if ($produccion ? $mailer !== 'smtp' : ! in_array($mailer, ['array', 'smtp'], true)) {
            return false;
        }

        $transporte = Mail::mailer()->getSymfonyTransport();
        if ($produccion && $transporte instanceof EsmtpTransport) {
            $transporte->setRequireTls(true);

            return true;
        }

        return ! $produccion && $this->esTransporteLocal($transporte);
    }

    private function esTransporteLocal(object $transporte): bool
    {
        if ($transporte instanceof ArrayTransport) {
            return true;
        }

        return $transporte instanceof EsmtpTransport
            && ($flujo = $transporte->getStream()) instanceof SocketStream
            && in_array($flujo->getHost(), ['localhost', '127.0.0.1', '::1'], true);
    }
}
