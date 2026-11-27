<?php

namespace App\Jobs;

use App\Actions\Autenticacion\RegistrarGraduando;
use App\Actions\Autenticacion\TransporteDeCorreoSeguro;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
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
        if (! $transporte->permiteDestinatario($this->correo)) {
            return;
        }

        try {
            if (! $registro->puedeEnviar($this->correo, $this->emision)) {
                return;
            }
            if (! $transporte->habilitar($this->correo)) {
                throw new RuntimeException;
            }

            Mail::send(
                ['html' => 'correo.verificacion', 'text' => 'correo.verificacion-texto'],
                ['codigo' => $this->codigo, 'vigencia' => RegistrarGraduando::VIGENCIA_MINUTOS],
                fn (Message $mensaje) => $mensaje->to($this->correo)->subject('Tu código de verificación | MasterExpress'),
            );
        } catch (Throwable) {
            // El transporte puede incluir el mensaje y las credenciales en sus excepciones.
            throw new RuntimeException('No se pudo procesar el correo de registro.');
        }
    }
}
