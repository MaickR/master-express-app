<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ExigirCambioInicial
{
    public function handle(Request $request, Closure $siguiente): Response
    {
        if ($request->user()?->cambio_clave_pendiente
            && ! $request->routeIs('mi-sesion', 'perfil.contrasena', 'logout', 'sanctum.csrf-cookie')) {
            return response()->json(['message' => 'Cambia tu contraseña temporal para continuar.'], 403)
                ->header('Cache-Control', 'no-store');
        }

        return $siguiente($request);
    }
}
