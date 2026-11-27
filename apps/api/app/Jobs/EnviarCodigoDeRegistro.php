<?php

namespace App\Jobs;

use App\Actions\Autenticacion\RegistrarGraduando;
use App\Actions\Autenticacion\TransporteDeCorreoSeguro;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class EnviarCodigoDeRegistro implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(
        private readonly string $correo,
        private readonly string $emision,
        #[\SensitiveParameter] private readonly string $codigo,
    ) {}

    public function handle(RegistrarGraduando $registro, TransporteDeCorreoSeguro $transporte): void
    {
        $produccion = app()->isProduction();
        if (! $produccion && ! Str::endsWith($this->correo, '@example.invalid')) {
            return;
        }

        try {
            if (! $registro->puedeEnviar($this->correo, $this->emision)) {
                return;
            }
            if (! $transporte->habilitar($produccion)) {
                throw new RuntimeException;
            }

            Mail::raw(
                "Tu código de registro de MasterExpress es {$this->codigo}. Vence 10 minutos después de solicitarlo.\n"
                .'Si no solicitaste el código, ignora este correo.',
                fn (Message $mensaje) => $mensaje->to($this->correo)->subject('Código de registro de MasterExpress'),
            );
        } catch (Throwable) {
            // El transporte puede incluir el mensaje y las credenciales en sus excepciones.
            throw new RuntimeException('No se pudo procesar el correo de registro.');
        }
    }
}
