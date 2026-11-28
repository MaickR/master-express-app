<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CrearCuentaInterna extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('gestionarCuentas', User::class);

        return true;
    }

    public function validationData(): array
    {
        $entrada = $this->json()->all();
        if (is_string($entrada['correo'] ?? null)) {
            $entrada['correo'] = mb_strtolower(trim($entrada['correo']));
        }

        return ['cuenta' => $entrada];
    }

    public function rules(): array
    {
        return [
            'cuenta' => ['required', 'array:nombre,correo,rol,password'],
            'cuenta.nombre' => ['required', 'string', 'max:255'],
            'cuenta.correo' => ['required', 'string', 'email:rfc', 'max:255'],
            'cuenta.password' => ['sometimes', ...ContrasenaDeCuenta::reglas()],
            'cuenta.rol' => ['required', Rule::in(User::ROLES_INTERNOS)],
        ];
    }
}
