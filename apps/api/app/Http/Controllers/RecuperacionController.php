<?php

namespace App\Http\Controllers;

use App\Actions\Autenticacion\RevocarSesiones;
use App\Http\Requests\SolicitudRecuperacion;
use App\Jobs\EnviarEnlaceDeRecuperacion;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

class RecuperacionController
{
    public function solicitar(SolicitudRecuperacion $request): Response
    {
        EnviarEnlaceDeRecuperacion::dispatch($request->validated('email'))
            ->onConnection(config('auth.cola_recuperacion'))->onQueue('recuperacion');

        return response()->noContent(202, ['Cache-Control' => 'no-store']);
    }

    public function restablecer(SolicitudRecuperacion $request, RevocarSesiones $revocar): JsonResponse|Response
    {
        $datos = $request->validated();
        $usuario = DB::transaction(function () use ($datos, $revocar): ?User {
            // Serializa el consumo del token y el cambio de contraseña para esta cuenta.
            $usuario = User::query()->where('email', $datos['email'])->lockForUpdate()->first();
            if (! $usuario?->puedeRecuperarContrasena()) {
                return null;
            }
            $resultado = Password::broker()->reset($datos, function (User $usuario, #[\SensitiveParameter] string $clave) use ($revocar): void {
                $usuario->forceFill(['password' => Hash::make($clave)]);
                $revocar->ejecutar($usuario);
            });

            return $resultado === Password::PASSWORD_RESET ? $usuario?->refresh() : null;
        }, 3);

        if ($usuario === null) {
            return response()->json([
                'errors' => ['token' => ['El enlace no es válido o venció. Solicita uno nuevo.']],
                'message' => 'El enlace no es válido o venció. Solicita uno nuevo.',
            ], 422, ['Cache-Control' => 'no-store']);
        }

        event(new PasswordReset($usuario));

        return response()->noContent(204, ['Cache-Control' => 'no-store']);
    }
}
