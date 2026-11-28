<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

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
            'operacion' => ['required', 'array:accion,rol,nombre'],
            'operacion.rol' => ['exclude_unless:operacion.accion,cambiar-rol', 'required', Rule::in(User::ROLES_INTERNOS)],
            'operacion.nombre' => ['exclude_unless:operacion.accion,editar', 'required', 'string', 'max:255'],
            'operacion.accion' => ['required', 'string', 'in:suspender,reactivar,revocar-sesiones,recuperar,cambiar-rol,editar,restablecer-clave'],
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
