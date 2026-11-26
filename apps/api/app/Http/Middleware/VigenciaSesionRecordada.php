<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Symfony\Component\HttpFoundation\Response;

class VigenciaSesionRecordada
{
    public const string VENCIMIENTO = 'sesion_recordada_vence';

    public const string VERSION = 'version_sesion';

    public function handle(Request $request, Closure $next): Response
    {
        $guard = Auth::guard('web');
        $sesion = $request->session();
        $nombre = $guard->getRecallerName();
        $cookie = $request->cookies->get($nombre);
        $ahora = now()->timestamp;

        $segmentos = explode('|', $cookie ?? '');
        $vence = count($segmentos) === 4 && ctype_digit($segmentos[3]) ? (int) $segmentos[3] : 0;
        if ($cookie !== null && $vence <= $ahora) {
            $request->cookies->remove($nombre);
            Cookie::queue(Cookie::forget($nombre));
        }

        $teniaSesion = $sesion->has($guard->getName());
        $usuario = $guard->user();
        $restaurada = ! $teniaSesion && $usuario && $guard->viaRemember();
        $revocada = $usuario && (! $usuario->activa
            || (! $restaurada && $sesion->get(self::VERSION, 0) !== $usuario->version_sesion));

        if ($revocada || ($sesion->has(self::VENCIMIENTO) && $sesion->get(self::VENCIMIENTO) <= $ahora)) {
            $request->cookies->remove($nombre);
            $guard->logoutCurrentDevice();
            $sesion->invalidate();
            $sesion->regenerateToken();
            Cookie::queue(Cookie::forget($nombre));
        } elseif ($restaurada) {
            $sesion->put(self::VENCIMIENTO, $vence);
            $sesion->put(self::VERSION, $usuario->version_sesion);
            $sesion->put('password_hash_web', $guard->hashPasswordForCookie($usuario->getAuthPassword()));
        }

        return $next($request);
    }
}
