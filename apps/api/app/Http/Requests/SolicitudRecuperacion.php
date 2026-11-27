<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class SolicitudRecuperacion extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($correo = $this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($correo))]);
        }
    }

    public function rules(): array
    {
        $reglas = ['email' => ['bail', 'required', 'string', 'email:rfc', 'max:255']];

        if ($this->routeIs('password.update')) {
            $reglas['token'] = ['bail', 'required', 'string', 'size:64', 'alpha_num:ascii'];
            $reglas['password'] = ContrasenaDeCuenta::reglas();
            $reglas['password_confirmation'] = ['bail', 'required', 'string', 'same:password'];
        }

        return $reglas;
    }

    public function messages(): array
    {
        return [
            'email.*' => 'Ingresa un correo electrónico válido.',
            'token.*' => 'El enlace no es válido o venció. Solicita uno nuevo.',
            'password.min' => 'Usa al menos 12 caracteres.',
            'password.*' => 'Ingresa una contraseña válida.',
            'password_confirmation.*' => 'Confirma la contraseña con el mismo valor.',
        ];
    }
}
