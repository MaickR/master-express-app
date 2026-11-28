<?php

namespace App\Http\Requests;

use App\Models\Evento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ListarEventos extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', Evento::class);

        return true;
    }

    public function validationData(): array
    {
        return $this->query();
    }

    public function rules(): array
    {
        return [
            'institucion_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'page' => ['sometimes', 'required', 'integer', 'between:1,2147483647'],
            'buscar' => ['sometimes', 'required', 'string', 'max:120'],
            'estado' => ['sometimes', 'required', 'in:proximo,en_ejecucion,finalizado,cancelado'],
            'vista' => ['sometimes', 'required', 'in:activa,historial'],
            'desde' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'hasta' => ['sometimes', 'required', 'date_format:Y-m-d', Rule::when($this->filled('desde'), ['after_or_equal:desde'])],
        ];
    }

    public function messages(): array
    {
        return [
            'institucion_id.*' => 'Selecciona una institución por su identificador.',
            'page.*' => 'Ingresa un número de página válido.',
        ];
    }
}
