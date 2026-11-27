<?php

namespace App\Providers;

use App\Actions\Autenticacion\IntentarAccesoInterno;
use App\Http\Responses\SesionSinContenido;
use Illuminate\Auth\Notifications\ResetPassword;
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
        ResetPassword::createUrlUsing(function ($usuario, #[\SensitiveParameter] string $token): string {
            $origen = rtrim((string) config('auth.url_spa'), '/');
            if (app()->isProduction() && ! preg_match('~\Ahttps://[a-zA-Z0-9.-]+(?::[0-9]+)?\z~', $origen)) {
                throw new \LogicException('Configure APP_URL con el origen HTTPS de la aplicación.');
            }

            return $origen.'/restablecer-contrasena#'.http_build_query([
                'token' => $token, 'email' => $usuario->getEmailForPasswordReset(),
            ], '', '&', PHP_QUERY_RFC3986);
        });

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

        RateLimiter::for('solicitar-recuperacion', function (Request $request): array {
            $entrada = $request->input('email');
            $correo = is_string($entrada) ? Str::lower(trim($entrada)) : '';

            return [
                Limit::perMinutes(15, 15)->by('ip:'.$request->ip()),
                Limit::perMinutes(15, 3)->by('correo:'.hash('sha256', $correo)),
            ];
        });

        RateLimiter::for('restablecer-contrasena', fn (Request $request) => Limit::perMinute(8)->by($request->ip()));

        RateLimiter::for('registro-graduando-solicitar', fn (Request $request): array => [
            Limit::perMinutes(15, 15)->by('ip:'.$request->ip()),
            Limit::perMinutes(15, 3)->by($this->claveDeCorreoParaRegistro($request)),
        ]);

        RateLimiter::for('registro-graduando-verificar', fn (Request $request): array => [
            Limit::perMinute(30)->by('ip:'.$request->ip()),
            Limit::perMinutes(15, 20)->by($this->claveDeCorreoParaRegistro($request)),
        ]);
    }

    private function claveDeCorreoParaRegistro(Request $request): string
    {
        $entrada = $request->isJson() ? $request->json('email') : null;
        $correo = is_string($entrada) ? Str::lower(trim($entrada)) : '';

        return 'correo:'.hash_hmac('sha256', 'limite-registro-graduando|'.$correo, app('encrypter')->getKey());
    }
}
