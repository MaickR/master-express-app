<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class GuardarPerfil extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('editarPerfil', User::class);

        return true;
    }

    public function validationData(): array
    {
        return ['perfil' => $this->json()->all()];
    }

    public function rules(): array
    {
        return [
            'perfil' => ['required', 'array:nombre'],
            'perfil.nombre' => ['required', 'string', 'max:255', 'not_regex:/[\x00-\x1F]/u'],
        ];
    }
}
