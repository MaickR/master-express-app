<?php

namespace App\Http\Requests;

use App\Models\Registro;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ListarRegistros extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', Registro::class);

        return true;
    }

    public function rules(): array
    {
        return [
            'evento_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'ceremonia_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'page' => ['sometimes', 'required', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'evento_id.*' => 'Selecciona un evento por su identificador.',
            'ceremonia_id.*' => 'Selecciona una ceremonia por su identificador.',
            'page.*' => 'Ingresa un número de página válido.',
        ];
    }
}
