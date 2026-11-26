<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
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
        $mailer = config('mail.default');
        if ($produccion ? $mailer !== 'smtp' : ! in_array($mailer, ['array', 'smtp'], true)) {
            Log::error('El correo de recuperación requiere un transporte habilitado.');

            return;
        }
        if (! $produccion && ! Str::endsWith($this->correo, '@example.invalid')) {
            return;
        }

        try {
            $transporte = Mail::mailer()->getSymfonyTransport();
            if ($produccion && $transporte instanceof EsmtpTransport) {
                $transporte->setRequireTls(true);
            } elseif ($produccion || ! $this->esTransporteLocal($transporte)) {
                Log::error('El correo de recuperación requiere SMTP con TLS o un transporte local de pruebas.');

                return;
            }

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
                $usuario->sendPasswordResetNotification($token);
            }
        } catch (Throwable $error) {
            // El error del transporte puede contener el mensaje SMTP completo.
            Log::error('No se pudo procesar el correo de recuperación.', ['tipo' => $error::class]);
        }
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
