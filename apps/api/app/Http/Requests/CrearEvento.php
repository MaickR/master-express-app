<?php

namespace App\Http\Requests;

use App\Models\Evento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class CrearEvento extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('create', Evento::class);

        return true;
    }

    public function validationData(): array
    {
        return ['evento' => $this->isJson() ? $this->json()->all() : $this->request->all()];
    }

    public function rules(): array
    {
        return [
            'evento' => ['required', 'array:institucion_id,sede_id,fecha,lugar,numero_ceremonias,operation_id'],
            'evento.institucion_id' => ['required', 'integer', 'min:1'],
            'evento.sede_id' => ['required', 'integer', 'min:1'],
            'evento.fecha' => ['required', 'date_format:Y-m-d', 'after_or_equal:1000-01-01'],
            'evento.lugar' => ['nullable', 'string', 'max:255'],
            'evento.numero_ceremonias' => ['required', 'integer', 'between:1,6'],
            'evento.operation_id' => ['required', 'uuid'],
        ];
    }

    public function messages(): array
    {
        return [
            'evento.required' => 'Envía los datos de programación del evento.',
            'evento.array' => 'Envía únicamente los campos del alta de programación.',
            'evento.institucion_id.*' => 'Selecciona una institución por su identificador.',
            'evento.sede_id.*' => 'Selecciona una sede de la institución elegida.',
            'evento.fecha.*' => 'Ingresa una fecha válida en formato AAAA-MM-DD.',
            'evento.lugar.*' => 'Ingresa un lugar de hasta 255 caracteres.',
            'evento.numero_ceremonias.*' => 'Selecciona entre una y seis ceremonias.',
            'evento.operation_id.*' => 'Envía un identificador de operación UUID.',
        ];
    }
}
