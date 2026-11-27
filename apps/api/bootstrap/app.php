<?php

use App\Http\Middleware\VigenciaSesionRecordada;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

$esRecuperacion = fn (Request $request): bool => $request->is('forgot-password', 'reset-password');
$esRegistroGraduando = fn (Request $request): bool => $request->is('api/registro-graduando/*');
$esRegistroInstitucion = fn (Request $request): bool => $request->is(
    'api/registro-institucion/*',
    'api/administracion/solicitudes-institucionales',
    'api/administracion/solicitudes-institucionales/*',
);

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->trimStrings(except: ['codigo', 'numero_documento']);
        $middleware->web(append: [VigenciaSesionRecordada::class]);
        $middleware->prependToPriorityList(AuthenticatesRequests::class, VigenciaSesionRecordada::class);
    })
    ->withSchedule(function (Schedule $agenda): void {
        $agenda->call(fn () => DB::table('desafios_de_registro')->where('vence_en', '<=', now()->timestamp)->delete())
            ->name('depurar-desafios-de-registro')->hourly();
    })
    ->withExceptions(function (Exceptions $exceptions) use ($esRecuperacion, $esRegistroGraduando, $esRegistroInstitucion): void {
        $exceptions->dontFlash(['token', 'codigo', 'numero_documento', 'motivo']);
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api', 'api/*', 'login', 'logout', 'sanctum/csrf-cookie')
                || $esRecuperacion($request) || $request->expectsJson(),
        );
        $exceptions->report(function (Throwable $error) use ($esRecuperacion, $esRegistroGraduando, $esRegistroInstitucion): ?bool {
            if (! app()->bound('request')) {
                return null;
            }

            if ($esRegistroGraduando(request())) {
                Log::error('Falló una operación de registro de graduando.', ['tipo' => $error::class]);
            } elseif ($esRegistroInstitucion(request())) {
                Log::error('Falló una operación de registro institucional.', ['tipo' => $error::class]);
            } elseif ($esRecuperacion(request())) {
                Log::error('Falló una operación de recuperación.', ['tipo' => $error::class]);
            } else {
                return null;
            }

            return false;
        });
        $exceptions->respond(function ($respuesta, $error, Request $request) use ($esRecuperacion, $esRegistroGraduando, $esRegistroInstitucion) {
            if (! $esRecuperacion($request) && ! $esRegistroGraduando($request) && ! $esRegistroInstitucion($request)) {
                return $respuesta;
            }
            if ($respuesta->getStatusCode() >= 500) {
                $respuesta = response()->json(['message' => 'El servicio no pudo completar la solicitud.'], 500);
            }

            $respuesta->headers->set('Cache-Control', 'no-store');

            return $respuesta;
        });
    })->create();
