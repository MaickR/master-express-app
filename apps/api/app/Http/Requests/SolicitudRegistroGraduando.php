<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class SolicitudRegistroGraduando extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->isJson() && is_string($correo = $this->json('email'))) {
            $this->merge(['email' => Str::lower(trim($correo))]);
        }
    }

    public function validationData(): array
    {
        return $this->isJson() ? $this->json()->all() : [];
    }

    public function rules(): array
    {
        $reglas = ['email' => ReglasDeContacto::correo()];

        if ($this->routeIs('registro-graduando.confirmar')) {
            $reglas['codigo'] = ['bail', 'required', 'string', 'regex:/\A[0-9]{6}\z/'];
        }

        if ($this->routeIs('registro-graduando.crear')) {
            return $reglas + [
                'nombres' => ReglasDeContacto::nombre(),
                'apellidos' => ReglasDeContacto::nombre(),
                'telefono' => ReglasDeContacto::telefono(),
                'tipo_documento' => ['bail', 'required_with:numero_documento', 'nullable', 'string',
                    'in:cedula_ciudadania,tarjeta_identidad'],
                'numero_documento' => ['bail', 'required_with:tipo_documento', 'nullable', 'string', 'regex:/\A[0-9]{1,32}\z/'],
                'password' => ContrasenaDeCuenta::reglas(),
                'password_confirmation' => ['bail', 'required', 'string', 'same:password'],
            ];
        }

        return $reglas;
    }

    public function after(): array
    {
        return [
            function (Validator $validador): void {
                if (array_diff_key($validador->getData(), $validador->getRules()) !== []) {
                    $validador->errors()->add('solicitud', 'La solicitud contiene campos no admitidos.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'email.*' => 'Ingresa un correo electrónico válido.',
            'codigo.*' => 'Ingresa un código de seis dígitos.',
            'nombres.*' => 'Ingresa los nombres con letras y signos propios del nombre (hasta 150 caracteres).',
            'apellidos.*' => 'Ingresa los apellidos con letras y signos propios del nombre (hasta 150 caracteres).',
            'telefono.*' => 'Ingresa entre 7 y 15 dígitos. Puedes incluir el indicativo.',
            'tipo_documento.*' => 'Selecciona Cédula de ciudadanía o Tarjeta de identidad.',
            'numero_documento.*' => 'Ingresa un número de documento de hasta 32 dígitos del 0 al 9.',
            'password.min' => 'Usa al menos 12 caracteres.',
            'password.*' => 'Ingresa una contraseña válida.',
            'password_confirmation.*' => 'Confirma la contraseña con el mismo valor.',
        ];
    }
}
