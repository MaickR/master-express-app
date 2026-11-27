<?php

namespace App\Http\Requests;

final class ReglasDeContacto
{
    public static function correo(): array
    {
        return ['bail', 'required', 'string', 'email:rfc', 'max:254'];
    }

    public static function nombre(): array
    {
        return ['bail', 'required', 'string', 'max:150', "regex:/\\A\\p{L}[\\p{L}\\p{M}\\p{Zs}\\p{Pd}.‘’']*\\z/u"];
    }

    public static function telefono(): array
    {
        return ['bail', 'required', 'string', 'max:30', 'regex:/\A\+?[0-9\h().-]+\z/u',
            function ($campo, $valor, $fallar): void {
                $digitos = preg_match_all('/[0-9]/', (string) $valor);
                if ($digitos < 7 || $digitos > 15) {
                    $fallar('Ingresa entre 7 y 15 dígitos. Puedes incluir el indicativo.');
                }
            }];
    }

    public static function nit(): array
    {
        return ['bail', 'required', 'string', 'max:30', 'regex:/\A[0-9]+(?:-[0-9]+)?\z/'];
    }

    public static function textoInstitucional(int $maximo): array
    {
        return ['bail', 'required', 'string', 'max:'.$maximo,
            "regex:/\\A[\\p{L}\\p{M}\\p{N}][\\p{L}\\p{M}\\p{N}\\p{Zs}\\p{Pd}.&'’(),]*\\z/u"];
    }
}
