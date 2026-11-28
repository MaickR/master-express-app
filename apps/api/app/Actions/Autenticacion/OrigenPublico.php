<?php

namespace App\Actions\Autenticacion;

class OrigenPublico
{
    public function paraCorreo(string $correo): string
    {
        $real = ! str_ends_with(strtolower($correo), '@example.invalid');
        $origen = rtrim((string) config(
            $real && app()->environment('local') ? 'mail.transaccional.origen_recuperacion_local' : 'auth.url_spa',
        ), '/');

        $transporte = app(TransporteDeCorreoSeguro::class);
        if ($transporte->demostracionInterna($correo) && $transporte->habilitar($correo)
            && preg_match('~\Ahttp://127\.0\.0\.1:[0-9]{1,5}\z~', $origen)) {
            return $origen;
        }

        if ($real && $origen === 'http://127.0.0.1:5173' && $transporte->sandboxLocalActivo()
            && $transporte->permiteDestinatario($correo)) {
            return $origen;
        }

        if ($real && ! preg_match('~\Ahttps://(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::[0-9]{1,5})?\z~i', $origen)) {
            throw new \LogicException('Configure un origen HTTPS para recuperar contraseñas por correo real.');
        }

        return $origen;
    }

    /** @param array<string, string> $parametros */
    public function enlace(string $ruta, string $correo, #[\SensitiveParameter] array $parametros): string
    {
        return $this->paraCorreo($correo).$ruta.'#'.http_build_query($parametros, '', '&', PHP_QUERY_RFC3986);
    }
}
