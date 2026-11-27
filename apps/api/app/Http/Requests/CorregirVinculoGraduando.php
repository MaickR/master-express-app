<?php

namespace App\Http\Requests;

use App\Models\VinculoGraduando;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

class CorregirVinculoGraduando extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('corregir', VinculoGraduando::class);

        return true;
    }

    public function validationData(): array
    {
        $datos = $this->isJson() ? $this->json()->all() : $this->request->all();
        if (is_string($datos['motivo'] ?? null)) {
            $datos['motivo'] = trim($datos['motivo']);
        }

        return ['correccion' => $datos];
    }

    public function rules(): array
    {
        return [
            'correccion' => ['required', 'array:motivo,cuenta_id'],
            'correccion.motivo' => ['bail', 'required', 'string', 'min:12', 'max:500', 'regex:/\A[^\p{C}]+\z/u'],
            'correccion.cuenta_id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validador): void {
                $motivo = $validador->getData()['correccion']['motivo'] ?? null;
                if (is_string($motivo) && preg_match('/\p{L}/u', $motivo) !== 1) {
                    $validador->errors()->add('correccion.motivo', 'Escribe el motivo con un texto claro.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'correccion.array' => 'Envía únicamente el motivo y la cuenta nueva.',
            'correccion.motivo.required' => 'Escribe el motivo de la corrección.',
            'correccion.motivo.min' => 'Escribe el motivo con un texto claro de al menos 12 caracteres.',
            'correccion.motivo.*' => 'Escribe el motivo con un texto claro de hasta 500 caracteres.',
            'correccion.cuenta_id.*' => 'Selecciona la cuenta nueva por su identificador.',
        ];
    }
}
