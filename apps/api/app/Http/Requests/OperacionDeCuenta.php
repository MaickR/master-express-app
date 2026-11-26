<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class OperacionDeCuenta extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('gestionarCuentas', User::class);

        return true;
    }

    public function validationData(): array
    {
        return ['operacion' => $this->isJson() ? $this->json()->all() : $this->request->all()];
    }

    public function rules(): array
    {
        return [
            'operacion' => ['required', 'array:accion'],
            'operacion.accion' => ['required', 'string', 'in:suspender,reactivar,revocar-sesiones'],
        ];
    }

    public function messages(): array
    {
        return [
            'operacion.*' => 'Envía únicamente una acción de cuenta.',
            'operacion.accion.*' => 'Selecciona una acción de cuenta válida.',
        ];
    }
}
