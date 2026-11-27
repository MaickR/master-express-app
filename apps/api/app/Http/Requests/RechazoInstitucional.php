<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RechazoInstitucional extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->isJson() && is_string($motivo = $this->json('motivo'))) {
            $this->merge(['motivo' => trim($motivo)]);
        }
    }

    public function validationData(): array
    {
        return $this->isJson() ? $this->json()->all() : [];
    }

    public function rules(): array
    {
        return [
            'motivo' => ['bail', 'required', 'string', 'min:12', 'max:500', 'regex:/\A[^\p{C}]+\z/u',
                function ($campo, $valor, $fallar): void {
                    if (is_string($valor) && preg_match('/\p{L}/u', $valor) !== 1) {
                        $fallar('Escribe el motivo del rechazo con un texto claro.');
                    }
                }],
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
            'motivo.required' => 'Escribe el motivo del rechazo.',
            'motivo.min' => 'Escribe el motivo del rechazo con un texto claro.',
            'motivo.*' => 'Escribe el motivo del rechazo con un texto claro de hasta 500 caracteres.',
        ];
    }
}
