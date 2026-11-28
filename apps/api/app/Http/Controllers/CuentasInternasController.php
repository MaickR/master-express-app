<?php

namespace App\Http\Controllers;

use App\Actions\Autenticacion\RevocarSesiones;
use App\Actions\CorreoInterno;
use App\Http\Requests\CrearCuentaInterna;
use App\Http\Requests\OperacionDeCuenta;
use App\Jobs\EnviarEnlaceDeRecuperacion;
use App\Models\EventoDeCuenta;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CuentasInternasController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('gestionarCuentas', User::class);

        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'rol' => ['nullable', Rule::in(User::ROLES_INTERNOS)],
            'estado' => ['nullable', 'in:activa,suspendida'],
            'acceso' => ['nullable', 'in:disponible,no-disponible'],
            'desde' => ['nullable', 'date_format:Y-m-d'],
            'hasta' => ['nullable', 'date_format:Y-m-d', ...($request->filled('desde') ? ['after_or_equal:desde'] : [])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $portal = fn ($roles) => $roles->whereIn('codigo', User::ROLES_DE_ACCESO);
        $busqueda = trim($filtros['q'] ?? '');
        $patron = '%'.strtr($busqueda, ['!' => '!!', '%' => '!%', '_' => '!_']).'%';

        $columnas = ['id', 'name', 'email', 'activa', 'principal', 'created_at'];
        $altaDisponible = Schema::hasColumn('users', 'cambio_clave_pendiente');
        if ($altaDisponible) {
            $columnas[] = 'cambio_clave_pendiente';
        }

        $cuentas = User::query()
            ->when($busqueda !== '', fn ($consulta) => $consulta->where(
                fn ($campos) => $campos->whereRaw("name LIKE ? ESCAPE '!'", [$patron])->orWhereRaw("email LIKE ? ESCAPE '!'", [$patron])
            ))
            ->when($filtros['rol'] ?? null, fn ($consulta, $rol) => $consulta->whereHas('roles', fn ($roles) => $roles->where('codigo', $rol)))
            ->when($filtros['estado'] ?? null, fn ($consulta, $estado) => $consulta->where('activa', $estado === 'activa'))
            ->when(($filtros['acceso'] ?? null) === 'disponible', fn ($consulta) => $consulta->where('activa', true)->whereHas('roles', $portal))
            ->when(($filtros['acceso'] ?? null) === 'no-disponible', fn ($consulta) => $consulta->where(
                fn ($estado) => $estado->where('activa', false)->orWhereDoesntHave('roles', $portal)
            ))
            ->when($filtros['desde'] ?? null, fn ($consulta, $desde) => $consulta->whereDate('created_at', '>=', $desde))
            ->when($filtros['hasta'] ?? null, fn ($consulta, $hasta) => $consulta->whereDate('created_at', '<=', $hasta))
            ->whereHas('roles', fn ($roles) => $roles->whereIn('codigo', User::ROLES_INTERNOS))
            ->with('roles:id,codigo')->orderBy('id')->simplePaginate(25, $columnas);

        return response()->json([
            'data' => $cuentas->getCollection()->map(fn (User $cuenta): array => [
                'id' => $cuenta->id,
                'nombre' => $cuenta->name,
                'correo' => $cuenta->email,
                'activa' => $cuenta->activa,
                'principal' => (bool) $cuenta->principal,
                'creada_en' => $cuenta->created_at?->toDateString(),
                'cambio_clave_pendiente' => (bool) $cuenta->cambio_clave_pendiente,
                'acceso_disponible' => $cuenta->activa && $cuenta->roles->whereIn('codigo', User::ROLES_DE_ACCESO)->isNotEmpty(),
                'roles' => $cuenta->roles->pluck('codigo'),
            ]),
            'hayMas' => $cuentas->hasMorePages(),
            'alta_disponible' => $altaDisponible,
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function store(CrearCuentaInterna $request, CorreoInterno $correos): JsonResponse
    {
        $this->exigirSoporteTemporal();
        $datos = $request->validated('cuenta');
        $correo = $datos['correo'];
        $correos->validar($correo);
        $generada = ! isset($datos['password']);
        $clave = $datos['password'] ?? Str::random(24);
        try {
            $id = DB::transaction(function () use ($request, $datos, $correo, $clave): int {
                Rol::query()->where('codigo', 'administrador')->lockForUpdate()->firstOrFail();
                $actor = User::query()->lockForUpdate()->findOrFail($request->user()->id);
                abort_if($actor->version_sesion !== $request->user()->version_sesion, 401);
                Gate::forUser($actor)->authorize('gestionarCuentas', User::class);
                if (User::query()->where('email', $correo)->exists()) {
                    throw ValidationException::withMessages(['cuenta.correo' => 'Ese correo ya existe.']);
                }
                $rol = Rol::query()->where('codigo', $datos['rol'])->firstOrFail();
                $cuenta = User::create([
                    'name' => trim($datos['nombre']), 'email' => $correo,
                    'password' => $clave,
                ]);
                $cuenta->forceFill(['cambio_clave_pendiente' => true])->saveOrFail();
                $cuenta->roles()->attach($rol->id);
                EventoDeCuenta::create(['actor_id' => $actor->id, 'cuenta_id' => $cuenta->id, 'accion' => 'crear-'.$datos['rol']]);

                return $cuenta->id;
            }, 3);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['cuenta.correo' => 'Ese correo ya existe.']);
        }

        return response()->json(['data' => ['id' => $id, 'correo' => $correo, ...($generada ? ['password_temporal' => $clave] : [])]], 201, ['Cache-Control' => 'no-store']);
    }

    public function auditoria(): JsonResponse
    {
        Gate::authorize('gestionarCuentas', User::class);
        $eventos = EventoDeCuenta::query()->orderByDesc('id')->simplePaginate(25,
            ['id', 'actor_id', 'cuenta_id', 'accion', 'created_at']);

        return response()->json(['data' => $eventos->items(), 'hayMas' => $eventos->hasMorePages()],
            headers: ['Cache-Control' => 'no-store']);
    }

    public function actualizar(OperacionDeCuenta $request, string $cuenta, RevocarSesiones $revocar): Response|JsonResponse
    {
        $cuentaId = filter_var($cuenta, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        abort_unless($cuentaId, 404, 'La cuenta interna no existe.');

        $actor = $request->user();
        $accion = $request->validated('operacion.accion');

        $temporal = $accion === 'restablecer-clave' ? Str::random(24) : null;
        $cerrarSesion = DB::transaction(function () use ($actor, $cuentaId, $accion, $revocar, $request, $temporal): bool {
            // Serializa el conteo y los cambios de estado entre administradores.
            $rol = Rol::query()->where('codigo', 'administrador')->lockForUpdate()->first();
            abort_unless($rol, 403, 'Tu cuenta no puede gestionar cuentas internas.');

            $actorVigente = User::query()->lockForUpdate()->findOrFail($actor->id);
            abort_if($actorVigente->version_sesion !== $actor->version_sesion, 401, 'Tu sesión terminó.');
            Gate::forUser($actorVigente)->authorize('gestionarCuentas', User::class);

            $objetivo = User::query()->lockForUpdate()->find($cuentaId);
            abort_unless($objetivo, 404, 'La cuenta interna no existe.');
            Gate::forUser($actorVigente)->authorize('operarCuenta', $objetivo);

            if ($accion === 'editar') {
                abort_if($objetivo->principal, 409, 'Edita el nombre de la cuenta principal desde Mi perfil.');
                $objetivo->name = trim($request->validated('operacion.nombre'));
                if ($objetivo->isDirty('name')) {
                    $objetivo->saveOrFail();
                    EventoDeCuenta::create(['actor_id' => $actor->id, 'cuenta_id' => $objetivo->id, 'accion' => 'editar-cuenta']);
                }

                return false;
            }

            if ($temporal !== null) {
                abort_if($objetivo->principal || $actor->is($objetivo), 409, 'Cambia tu contraseña desde Mi perfil.');
                $this->exigirSoporteTemporal();
                $objetivo->forceFill(['password' => $temporal, 'cambio_clave_pendiente' => true]);
                Password::broker()->deleteToken($objetivo);
                $revocar->ejecutar($objetivo);
                EventoDeCuenta::create(['actor_id' => $actor->id, 'cuenta_id' => $objetivo->id, 'accion' => 'restablecer-clave']);

                return false;
            }

            if ($accion === 'cambiar-rol') {
                abort_if($objetivo->principal, 409, 'La cuenta principal conserva su rol.');
                $nuevoRol = $request->validated('operacion.rol');
                $ultimo = in_array('administrador', $objetivo->codigosDeAcceso(), true)
                    && $objetivo->activa && $nuevoRol !== 'administrador'
                    && ! $rol->usuarios()->where('activa', true)->whereKeyNot($objetivo->id)->exists();
                abort_if($ultimo, 409, 'Debe quedar al menos un administrador activo.');
                // No intervenir identidades externas ni retirar sus vínculos.
                abort_if($objetivo->roles()->whereNotIn('codigo', User::ROLES_INTERNOS)->exists(), 409,
                    'La cuenta tiene roles externos y requiere una revisión específica.');
                $objetivo->roles()->sync([Rol::query()->where('codigo', $nuevoRol)->firstOrFail()->id]);
                $revocar->ejecutar($objetivo);
                EventoDeCuenta::create(['actor_id' => $actor->id, 'cuenta_id' => $objetivo->id, 'accion' => 'rol-'.$nuevoRol]);

                return $actor->is($objetivo);
            }

            abort_if($accion === 'suspender' && $objetivo->principal, 409, 'La cuenta principal no se puede suspender.');
            if ($accion === 'recuperar') {
                EventoDeCuenta::create(['actor_id' => $actor->id, 'cuenta_id' => $objetivo->id, 'accion' => 'iniciar-recuperacion']);
                EnviarEnlaceDeRecuperacion::dispatch($objetivo->email)
                    ->onConnection(config('auth.cola_recuperacion'))->onQueue('recuperacion')->afterCommit();

                return false;
            }

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

        if ($temporal !== null) {
            return response()->json(['data' => ['password_temporal' => $temporal]], headers: ['Cache-Control' => 'no-store']);
        }

        return response()->noContent(headers: ['Cache-Control' => 'no-store']);
    }

    private function exigirSoporteTemporal(): void
    {
        abort_unless(Schema::hasColumn('users', 'cambio_clave_pendiente'), 503, 'El alta con contraseña temporal todavía no está disponible.');
    }
}
