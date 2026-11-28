<?php

namespace App\Providers;

use App\Actions\Autenticacion\IntentarAcceso;
use App\Actions\Autenticacion\OrigenPublico;
use App\Http\Responses\SesionSinContenido;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
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
        ResetPassword::toMailUsing(function ($usuario, #[\SensitiveParameter] string $token): MailMessage {
            $correo = $usuario->getEmailForPasswordReset();
            $url = app(OrigenPublico::class)->enlace('/restablecer-contrasena', $correo, [
                'token' => $token, 'email' => $correo,
            ]);

            return (new MailMessage)->subject('Restablece tu contraseña | MasterExpress')->view(
                ['html' => 'correo.recuperacion', 'text' => 'correo.recuperacion-texto'],
                ['url' => $url, 'vigencia' => (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire')],
            );
        });

        Fortify::authenticateThrough(fn (): array => [
            CanonicalizeUsername::class,
            IntentarAcceso::class,
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
            Limit::perMinutes(15, 3)->by($this->claveDeCorreo($request, 'limite-registro-graduando')),
        ]);

        RateLimiter::for('registro-graduando-verificar', fn (Request $request): array => [
            Limit::perMinute(30)->by('ip:'.$request->ip()),
            Limit::perMinutes(15, 20)->by($this->claveDeCorreo($request, 'limite-registro-graduando')),
        ]);

        RateLimiter::for('registro-institucion-solicitar', fn (Request $request): array => [
            Limit::perMinutes(15, 15)->by('ip:'.$request->ip()),
            Limit::perMinutes(15, 3)->by($this->claveDeCorreo($request, 'limite-registro-institucion')),
        ]);

        RateLimiter::for('registro-institucion-verificar', fn (Request $request): array => [
            Limit::perMinute(30)->by('ip:'.$request->ip()),
            Limit::perMinutes(15, 20)->by($this->claveDeCorreo($request, 'limite-registro-institucion')),
        ]);

        RateLimiter::for('activar-institucion', fn (Request $request) => Limit::perMinute(8)->by($request->ip()));

        RateLimiter::for('decision-institucional', fn (Request $request) => Limit::perMinute(30)->by(
            'usuario:'.($request->user()?->getKey() ?? $request->ip()),
        ));

        RateLimiter::for('vinculacion-graduandos', fn (Request $request) => Limit::perMinute(30)->by(
            'usuario:'.($request->user()?->getKey() ?? $request->ip()),
        ));
    }

    private function claveDeCorreo(Request $request, string $uso): string
    {
        $entrada = $request->isJson() ? $request->json('email') : $request->input('email');
        $correo = is_string($entrada) ? Str::lower(trim($entrada)) : '';

        return 'correo:'.hash_hmac('sha256', $uso.'|'.$correo, app('encrypter')->getKey());
    }
}
