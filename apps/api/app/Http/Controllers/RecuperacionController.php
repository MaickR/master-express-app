<?php

namespace App\Http\Controllers;

use App\Http\Requests\SolicitudRecuperacion;
use App\Jobs\EnviarEnlaceDeRecuperacion;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class RecuperacionController
{
    public function solicitar(SolicitudRecuperacion $request): Response
    {
        EnviarEnlaceDeRecuperacion::dispatch($request->validated('email'))
            ->onConnection(config('auth.cola_recuperacion'))->onQueue('recuperacion');

        return response()->noContent(202, ['Cache-Control' => 'no-store']);
    }

    public function restablecer(SolicitudRecuperacion $request): JsonResponse|Response
    {
        $datos = $request->validated();
        $usuario = DB::transaction(function () use ($datos): ?User {
            // Serializa el consumo del token y el cambio de contraseña para esta cuenta.
            $usuario = User::query()->where('email', $datos['email'])->lockForUpdate()->first();
            $resultado = Password::broker()->reset($datos, function (User $usuario, #[\SensitiveParameter] string $clave): void {
                $usuario->forceFill(['password' => $clave, 'remember_token' => Str::random(60)])->saveOrFail();

                DB::connection(config('session.connection'))
                    ->table(config('session.table'))->where('user_id', $usuario->getKey())->delete();
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
