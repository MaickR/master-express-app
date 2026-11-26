<?php

namespace App\Http\Requests;

use App\Models\Evento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

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
