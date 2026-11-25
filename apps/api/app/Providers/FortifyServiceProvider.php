<?php

namespace App\Providers;

use App\Actions\Autenticacion\IntentarAccesoInterno;
use App\Http\Responses\SesionSinContenido;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Fortify\Actions\CanonicalizeUsername;
use Laravel\Fortify\Actions\PrepareAuthenticatedSession;
use Laravel\Fortify\Contracts\LoginResponse;
use Laravel\Fortify\Contracts\LogoutResponse;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Las rutas predeterminadas también incluyen confirmación de contraseña.
        Fortify::ignoreRoutes();
        $this->app->bind(LoginResponse::class, SesionSinContenido::class);
        $this->app->bind(LogoutResponse::class, SesionSinContenido::class);
    }

    public function boot(): void
    {
        Fortify::authenticateThrough(fn (): array => [
            CanonicalizeUsername::class,
            IntentarAccesoInterno::class,
            PrepareAuthenticatedSession::class,
        ]);

        RateLimiter::for('login', function (Request $request): array {
            $entrada = $request->input('email');
            $correo = is_string($entrada) ? Str::lower($entrada) : '';
            $ip = $request->ip();

            return [
                Limit::perMinute(30)->by('ip:'.$ip),
                Limit::perMinute(5)->by('correo:'.hash('sha256', $correo.'|'.$ip)),
            ];
        });
    }
}
