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
            'page' => ['sometimes', 'required', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'page.*' => 'Ingresa un número de página válido.',
        ];
    }
}
