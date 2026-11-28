<?php

namespace App\Actions;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CorreoInterno
{
    public const array RESERVADOS = ['admin', 'administrador', 'root', 'soporte', 'postmaster', 'abuse', 'security', 'noreply'];

    public function validar(string $correo): void
    {
        $local = explode('@', $correo, 2)[0];
        $identificador = preg_split('/[.+_-]/', $local, 2)[0];
        if (strlen($local) > 64 || in_array($identificador, self::RESERVADOS, true)) {
            throw ValidationException::withMessages(['cuenta.correo' => 'Esta dirección está reservada o supera el límite permitido.']);
        }
    }

    public function generar(string $nombres, string $apellidos, string $rol): string
    {
        $normalizar = fn (string $valor): string => trim(preg_replace('/[^a-z0-9]+/', '.', Str::lower(Str::ascii(trim($valor)))), '.');
        $nombre = $normalizar($nombres);
        $apellido = $normalizar($apellidos);
        $sufijo = $rol === 'colaborador' ? $apellido : ($rol === 'administrador' ? 'admin' : $rol);
        $local = $nombre.'.'.$sufijo;
        if ($nombre === '' || $apellido === '' || strlen($local) > 64
            || in_array(explode('.', $nombre)[0], self::RESERVADOS, true)) {
            throw ValidationException::withMessages(['cuenta.nombres' => 'El nombre no permite generar un correo interno válido o está reservado.']);
        }

        return $local.'@masterexpress.app';
    }
}
