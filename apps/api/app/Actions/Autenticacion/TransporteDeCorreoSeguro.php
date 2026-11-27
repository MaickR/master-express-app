<?php

namespace App\Actions\Autenticacion;

use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;

class TransporteDeCorreoSeguro
{
    public function habilitar(bool $produccion): bool
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

        return ! $produccion && ($transporte instanceof ArrayTransport
            || ($transporte instanceof EsmtpTransport
                && ($flujo = $transporte->getStream()) instanceof SocketStream
                && in_array($flujo->getHost(), ['localhost', '127.0.0.1', '::1'], true)));
    }
}
