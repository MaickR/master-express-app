<?php

namespace App\Http\Requests;

use App\Models\Registro;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class CrearRegistro extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('create', Registro::class);

        return true;
    }

    public function validationData(): array
    {
        return ['registro' => $this->isJson() ? $this->json()->all() : $this->request->all()];
    }

    public function rules(): array
    {
        return [
            'registro' => ['required', 'array:operation_id,evento_id,graduando_id,programa_academico'],
            'registro.operation_id' => ['required', 'uuid'],
            'registro.evento_id' => ['required', 'integer', 'min:1'],
            'registro.graduando_id' => ['required', 'integer', 'min:1'],
            'registro.programa_academico' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'registro.required' => 'Envía los datos de inscripción.',
            'registro.array' => 'Envía únicamente los campos del alta de inscripción.',
            'registro.operation_id.*' => 'Envía un identificador de operación UUID.',
            'registro.evento_id.*' => 'Selecciona un evento por su identificador.',
            'registro.graduando_id.*' => 'Selecciona un graduando por su identificador interno.',
            'registro.programa_academico.*' => 'Ingresa un programa académico de hasta 255 caracteres.',
        ];
    }
}
