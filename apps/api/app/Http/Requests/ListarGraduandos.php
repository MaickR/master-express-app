<?php

namespace App\Http\Requests;

use App\Models\Graduando;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ListarGraduandos extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', Graduando::class);

        return true;
    }

    public function rules(): array
    {
        return [
            'buscar' => ['sometimes', 'nullable', 'string', 'max:150'],
            'vinculacion' => ['sometimes', 'required', 'in:activa,sin_vinculo'],
            'institucion_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'sede_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'evento_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'ceremonia_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'page' => ['sometimes', 'required', 'integer', 'between:1,2147483647'],
        ];
    }
}
