<?php

namespace App\Http\Middleware;

use Closure;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Symfony\Component\HttpFoundation\Response;

class AutenticarSesionSpa extends AuthenticateSession
{
    public function handle($request, Closure $next): Response
    {
        return app(VigenciaSesionRecordada::class)->handle(
            $request, fn ($peticion) => parent::handle($peticion, $next),
        );
    }
}
