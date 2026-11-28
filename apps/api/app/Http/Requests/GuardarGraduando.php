<?php

namespace App\Http\Requests;

use App\Models\Graduando;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class GuardarGraduando extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('create', Graduando::class);

        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['nombre_completo', 'correo', 'telefono', 'tipo_documento', 'numero_documento'] as $campo) {
            if (is_string($this->input($campo))) {
                $valor = trim($this->input($campo));
                $this->merge([$campo => $campo === 'correo' ? mb_strtolower($valor) : $valor]);
            }
        }
    }

    public function validationData(): array
    {
        return ['graduando' => $this->isJson() ? $this->json()->all() : $this->request->all()];
    }

    public function rules(): array
    {
        return [
            'graduando' => ['required', 'array:nombre_completo,correo,telefono,tipo_documento,numero_documento,operation_id,revision'],
            'graduando.nombre_completo' => ['required', 'string', 'max:255', 'regex:/\p{L}/u'],
            'graduando.correo' => ['nullable', 'string', 'email:rfc', 'max:254'],
            'graduando.telefono' => ['nullable', 'string', 'regex:/^[0-9]{7,15}$/D'],
            'graduando.tipo_documento' => ['nullable', 'required_with:graduando.numero_documento', 'in:CC,TI'],
            'graduando.numero_documento' => ['nullable', 'required_with:graduando.tipo_documento', 'string', 'regex:/^[0-9]{1,30}$/D'],
            'graduando.operation_id' => [$this->route('graduando') === null ? 'required' : 'prohibited', 'uuid'],
            'graduando.revision' => [$this->route('graduando') !== null ? 'required' : 'prohibited', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'graduando.array' => 'Envía únicamente los campos del perfil operativo.',
            'graduando.nombre_completo.*' => 'Ingresa un nombre de hasta 255 caracteres.',
            'graduando.correo.*' => 'Ingresa un correo válido.',
            'graduando.telefono.*' => 'Ingresa de 7 a 15 dígitos para el teléfono.',
            'graduando.tipo_documento.*' => 'Selecciona CC o TI junto con el número de documento.',
            'graduando.numero_documento.*' => 'Ingresa el documento como texto de 1 a 30 dígitos.',
            'graduando.operation_id.*' => 'La operación requiere un identificador válido.',
            'graduando.revision.*' => 'Actualiza el perfil antes de guardar.',
        ];
    }
}
