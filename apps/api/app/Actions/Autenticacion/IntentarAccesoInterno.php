<?php

namespace App\Actions\Autenticacion;

use App\Http\Middleware\VigenciaSesionRecordada;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Http\Requests\LoginRequest;

class IntentarAccesoInterno
{
    public function handle(LoginRequest $request, Closure $next): mixed
    {
        $guard = Auth::guard('web');
        abort_if($guard->check(), 409, 'Ya hay una sesión activa.');

        $request->validate(['remember' => ['sometimes', 'boolean']]);
        $recordar = $request->boolean('remember');
        $duracion = config('auth.duracion_recuerdo');
        $guard->setRememberDuration($duracion);

        $autenticado = $guard->attemptWhen(
            $request->only('email', 'password'),
            fn (User $usuario): bool => $usuario->codigosDeAcceso() !== [],
            $recordar,
        );

        if (! $autenticado) {
            throw ValidationException::withMessages(['email' => 'Las credenciales no permiten iniciar sesión.']);
        }

        if ($recordar) {
            $vence = now()->addMinutes($duracion)->timestamp;
            $request->session()->put(VigenciaSesionRecordada::VENCIMIENTO, $vence);
            $cookie = Cookie::queued($guard->getRecallerName());
            // Laravel cifra el vencimiento junto con los tres segmentos del recaller.
            Cookie::queue($cookie->withValue($cookie->getValue().'|'.$vence));
        }

        return $next($request);
    }
}
