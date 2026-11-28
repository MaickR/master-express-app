<?php

namespace App\Http\Requests;

use App\Models\VinculoGraduando;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ListarVinculosGraduandos extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', VinculoGraduando::class);

        return true;
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'required', 'integer', 'between:1,2147483647'],
            'buscar' => ['sometimes', 'nullable', 'string', 'max:150'],
            'vinculacion' => ['sometimes', 'required', 'in:activa,sin_vinculo'],
        ];
    }

    public function messages(): array
    {
        return [
            'page.*' => 'Ingresa un número de página válido.',
            'buscar.*' => 'La búsqueda admite hasta 150 caracteres.',
            'vinculacion.*' => 'Selecciona un estado de vinculación válido.',
        ];
    }
}
