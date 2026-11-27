<?php

namespace App\Http\Requests;

final class ContrasenaDeCuenta
{
    public static function reglas(): array
    {
        return ['bail', 'required', 'string', 'min:12', function ($campo, #[\SensitiveParameter] $valor, $fallar): void {
            if (strlen($valor) > 72 || str_contains($valor, "\0")) {
                $fallar('Usa una contraseña de hasta 72 bytes y sin caracteres nulos.');
            }
        }];
    }
}
