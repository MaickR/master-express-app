<?php

namespace App\Http\Requests;

use App\Models\VinculoGraduando;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class CrearVinculoGraduando extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('create', VinculoGraduando::class);

        return true;
    }

    public function validationData(): array
    {
        return ['vinculo' => $this->isJson() ? $this->json()->all() : $this->request->all()];
    }

    public function rules(): array
    {
        return [
            'vinculo' => ['required', 'array:graduando_id,cuenta_id'],
            'vinculo.graduando_id' => ['required', 'integer', 'min:1'],
            'vinculo.cuenta_id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'vinculo.required' => 'Envía el graduando y la cuenta que quieres vincular.',
            'vinculo.array' => 'Envía únicamente el identificador del graduando y el de la cuenta.',
            'vinculo.graduando_id.*' => 'Selecciona un graduando por su identificador.',
            'vinculo.cuenta_id.*' => 'Selecciona una cuenta de Graduando por su identificador.',
        ];
    }
}
