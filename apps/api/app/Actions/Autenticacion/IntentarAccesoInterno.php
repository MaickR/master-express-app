<?php

namespace App\Actions\Autenticacion;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Http\Requests\LoginRequest;

class IntentarAccesoInterno
{
    public function handle(LoginRequest $request, Closure $next): mixed
    {
        $guard = Auth::guard('web');
        abort_if($guard->check(), 409, 'Ya hay una sesión activa.');

        $autenticado = $guard->attemptWhen(
            $request->only('email', 'password'),
            fn (User $usuario): bool => $usuario->codigosDeAcceso() !== [],
        );

        if (! $autenticado) {
            throw ValidationException::withMessages(['email' => 'Las credenciales no permiten iniciar sesión.']);
        }

        return $next($request);
    }
}
