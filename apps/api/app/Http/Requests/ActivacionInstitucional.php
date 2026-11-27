<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class ActivacionInstitucional extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($correo = $this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($correo))]);
        }
    }

    public function validationData(): array
    {
        return $this->isJson() ? $this->json()->all() : [];
    }

    public function rules(): array
    {
        return [
            'email' => ReglasDeContacto::correo(),
            'token' => ['bail', 'required', 'string', 'size:64', 'alpha_num:ascii'],
            'password' => ContrasenaDeCuenta::reglas(),
            'password_confirmation' => ['bail', 'required', 'string', 'same:password'],
        ];
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
            'token.*' => 'El enlace no es válido o venció. Solicita uno nuevo.',
            'password.min' => 'Usa al menos 12 caracteres.',
            'password.*' => 'Ingresa una contraseña válida.',
            'password_confirmation.*' => 'Confirma la contraseña con el mismo valor.',
        ];
    }
}
