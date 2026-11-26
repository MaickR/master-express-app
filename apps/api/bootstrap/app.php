<?php

use App\Http\Middleware\VigenciaSesionRecordada;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

$esRecuperacion = fn (Request $request): bool => $request->is('forgot-password', 'reset-password');

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->web(append: [VigenciaSesionRecordada::class]);
        $middleware->prependToPriorityList(AuthenticatesRequests::class, VigenciaSesionRecordada::class);
    })
    ->withExceptions(function (Exceptions $exceptions) use ($esRecuperacion): void {
        $exceptions->dontFlash(['token']);
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api', 'api/*', 'login', 'logout', 'sanctum/csrf-cookie')
                || $esRecuperacion($request) || $request->expectsJson(),
        );
        $exceptions->report(function (Throwable $error) use ($esRecuperacion): ?bool {
            if (! app()->bound('request') || ! $esRecuperacion(request())) {
                return null;
            }

            Log::error('Falló una operación de recuperación.', ['tipo' => $error::class]);

            return false;
        });
        $exceptions->respond(function ($respuesta, $error, Request $request) use ($esRecuperacion) {
            if (! $esRecuperacion($request)) {
                return $respuesta;
            }
            if ($respuesta->getStatusCode() >= 500) {
                $respuesta = response()->json(['message' => 'El servicio no pudo completar la solicitud.'], 500);
            }

            $respuesta->headers->set('Cache-Control', 'no-store');

            return $respuesta;
        });
    })->create();
