<?php

namespace App\Http\Requests;

class CambiarContrasenaPropia extends GuardarPerfil
{
    public function validationData(): array
    {
        return ['clave' => $this->json()->all()];
    }

    public function rules(): array
    {
        return [
            'clave' => ['required', 'array:current_password,password,password_confirmation'],
            'clave.current_password' => ['required', 'string', 'current_password:web'],
            'clave.password' => ContrasenaDeCuenta::reglas(),
            'clave.password_confirmation' => ['required', 'string', 'same:clave.password'],
        ];
    }
}
