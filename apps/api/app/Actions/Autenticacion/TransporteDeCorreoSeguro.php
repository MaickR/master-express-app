<?php

namespace App\Actions\Autenticacion;

use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;

class TransporteDeCorreoSeguro
{
    private const string HOST_RESEND = 'smtp.resend.com';

    public function sandboxLocalActivo(): bool
    {
        return app()->environment('local')
            && config('mail.transaccional.prueba_real_local') === true
            && config('mail.transaccional.resend_sandbox') === true
            && config('mail.from.address') === 'onboarding@resend.dev';
    }

    public function permiteDestinatario(string $correo): bool
    {
        if (! filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        $correo = strtolower($correo);
        if ($this->demostracionInterna($correo)) {
            return true;
        }

        if (str_ends_with($correo, '@example.invalid')) {
            return ! app()->isProduction();
        }

        return ! str_ends_with($correo, '.invalid') && (app()->isProduction()
            || (app()->environment('local') && config('mail.transaccional.prueba_real_local') === true
                && in_array($correo, config('mail.transaccional.destinatarios_locales', []), true)));
    }

    public function habilitar(string $correo): bool
    {
        if (! $this->permiteDestinatario($correo)) {
            return false;
        }

        $mailer = config('mail.default');
        $real = ! str_ends_with(strtolower($correo), '@example.invalid') && ! $this->demostracionInterna($correo);
        if ($real ? $mailer !== 'smtp' || ! $this->configuracionResend() : ! in_array($mailer, ['array', 'smtp'], true)) {
            return false;
        }

        $transporte = Mail::mailer()->getSymfonyTransport();
        if (! $real && $transporte instanceof ArrayTransport) {
            return true;
        }
        if (! $transporte instanceof EsmtpTransport || ! ($flujo = $transporte->getStream()) instanceof SocketStream) {
            return false;
        }
        if (! $real) {
            return in_array($flujo->getHost(), ['localhost', '127.0.0.1', '::1'], true);
        }

        $ssl = $flujo->getStreamOptions()['ssl'] ?? [];

        return $flujo->getHost() === self::HOST_RESEND && $flujo->getPort() === 465
            && $flujo->isTLS() && $transporte->getUsername() === 'resend'
            && ($ssl['verify_peer'] ?? true) === true && ($ssl['verify_peer_name'] ?? true) === true
            && ($ssl['allow_self_signed'] ?? false) === false;
    }

    public function demostracionInterna(string $correo): bool
    {
        // * En QA, los correos internos solo pueden llegar a array o SMTP de bucle local.
        return app()->environment('testing') && config('database.default') === 'mysql_pruebas'
            && str_ends_with(strtolower($correo), '@masterexpress.app');
    }

    private function configuracionResend(): bool
    {
        $smtp = config('mail.mailers.smtp');
        $secreto = config('services.resend.key');
        $remitente = (string) config('mail.from.address');

        return empty($smtp['url']) && ($smtp['transport'] ?? null) === 'smtp'
            && ($smtp['host'] ?? null) === self::HOST_RESEND && (int) ($smtp['port'] ?? 0) === 465
            && ($smtp['scheme'] ?? null) === 'smtps' && ($smtp['username'] ?? null) === 'resend'
            && is_string($secreto) && trim($secreto) !== '' && hash_equals($secreto, (string) ($smtp['password'] ?? ''))
            && (config('mail.transaccional.resend_sandbox') === true
                ? $this->sandboxLocalActivo()
                : $this->remitenteDeDominioVerificado($remitente));
    }

    private function remitenteDeDominioVerificado(string $remitente): bool
    {
        $dominio = strtolower(trim((string) config('mail.transaccional.dominio_verificado')));

        return filter_var($remitente, FILTER_VALIDATE_EMAIL) !== false
            && str_contains($dominio, '.') && str_ends_with(strtolower($remitente), '@'.$dominio)
            && ! preg_match('/\.(invalid|test|example|localhost)\z/', $dominio)
            && ! in_array($dominio, ['example.com', 'example.net', 'example.org', 'resend.dev'], true);
    }
}
