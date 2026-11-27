<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MiSesionController
{
    public function __invoke(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $roles = $usuario->codigosDeSesion();

        if ($roles === []) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json(['message' => 'La cuenta ya no tiene acceso.'], 403)
                ->header('Cache-Control', 'no-store');
        }

        return response()->json(['data' => [
            'id' => $usuario->getKey(),
            'nombre' => $usuario->name,
            'correo' => $usuario->email,
            'roles' => $roles,
        ]])->header('Cache-Control', 'no-store');
    }
}
