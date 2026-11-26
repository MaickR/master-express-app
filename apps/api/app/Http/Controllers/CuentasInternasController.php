<?php

namespace App\Http\Controllers;

use App\Actions\Autenticacion\RevocarSesiones;
use App\Http\Requests\OperacionDeCuenta;
use App\Models\EventoDeCuenta;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CuentasInternasController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('gestionarCuentas', User::class);

        $cuentas = User::query()
            ->whereHas('roles', fn ($roles) => $roles->whereIn('codigo', User::ROLES_DE_ACCESO))
            ->orderBy('id')->simplePaginate(25, ['id', 'name', 'email', 'activa']);

        return response()->json([
            'data' => $cuentas->getCollection()->map(fn (User $cuenta): array => [
                'id' => $cuenta->id,
                'nombre' => $cuenta->name,
                'correo' => $cuenta->email,
                'activa' => $cuenta->activa,
            ]),
            'hayMas' => $cuentas->hasMorePages(),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function actualizar(OperacionDeCuenta $request, string $cuenta, RevocarSesiones $revocar): Response
    {
        $cuentaId = filter_var($cuenta, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        abort_unless($cuentaId, 404, 'La cuenta interna no existe.');

        $actor = $request->user();
        $accion = $request->validated('operacion.accion');

        $cerrarSesion = DB::transaction(function () use ($actor, $cuentaId, $accion, $revocar): bool {
            // Serializa el conteo y los cambios de estado entre administradores.
            $rol = Rol::query()->where('codigo', 'administrador')->lockForUpdate()->first();
            abort_unless($rol, 403, 'Tu cuenta no puede gestionar cuentas internas.');

            $actorVigente = User::query()->lockForUpdate()->findOrFail($actor->id);
            abort_if($actorVigente->version_sesion !== $actor->version_sesion, 401, 'Tu sesión terminó.');
            Gate::forUser($actorVigente)->authorize('gestionarCuentas', User::class);

            $objetivo = User::query()->lockForUpdate()->find($cuentaId);
            abort_unless($objetivo, 404, 'La cuenta interna no existe.');
            Gate::forUser($actorVigente)->authorize('operarCuenta', $objetivo);

            if ($accion === 'suspender' && $objetivo->activa) {
                $ultimoAdministrador = in_array('administrador', $objetivo->codigosDeAcceso(), true)
                    && ! $rol->usuarios()->where('activa', true)->whereKeyNot($objetivo->id)->exists();
                abort_if($ultimoAdministrador, 409, 'Debe quedar al menos un administrador activo.');
                $objetivo->activa = false;
            } elseif ($accion === 'reactivar' && ! $objetivo->activa) {
                $objetivo->activa = true;
                $objetivo->saveOrFail();
            } elseif ($accion !== 'revocar-sesiones') {
                return false;
            }

            $revocada = $accion !== 'reactivar';
            if ($revocada) {
                $revocar->ejecutar($objetivo);
            }

            EventoDeCuenta::create(['actor_id' => $actor->id, 'cuenta_id' => $objetivo->id, 'accion' => $accion]);

            return $revocada && $actor->is($objetivo);
        }, 3);

        if ($cerrarSesion) {
            Auth::guard('web')->logoutCurrentDevice();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->noContent(headers: ['Cache-Control' => 'no-store']);
    }
}
