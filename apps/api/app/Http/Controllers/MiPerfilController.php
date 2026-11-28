<?php

namespace App\Http\Controllers;

use App\Actions\Autenticacion\RevocarSesiones;
use App\Http\Requests\CambiarContrasenaPropia;
use App\Http\Requests\GuardarPerfil;
use App\Models\EventoDeCuenta;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class MiPerfilController extends Controller
{
    public function show(Request $request)
    {
        Gate::authorize('editarPerfil', User::class);
        $cuenta = $request->user();

        return response()->json(['data' => [
            'nombre' => $cuenta->name, 'correo' => $cuenta->email,
            'roles' => $cuenta->roles()->orderBy('codigo')->pluck('codigo'),
            'activa' => $cuenta->activa, 'principal' => (bool) $cuenta->principal,
            'correo_verificado' => $cuenta->email_verified_at !== null,
        ]], headers: ['Cache-Control' => 'no-store']);
    }

    public function guardar(GuardarPerfil $request)
    {
        DB::transaction(function () use ($request): void {
            $cuenta = $this->bloquear($request);
            $cuenta->name = $request->validated('perfil.nombre');
            if ($cuenta->isDirty('name')) {
                $cuenta->saveOrFail();
                EventoDeCuenta::create(['actor_id' => $cuenta->id, 'cuenta_id' => $cuenta->id, 'accion' => 'editar-perfil']);
            }
        }, 3);

        return response()->noContent(headers: ['Cache-Control' => 'no-store']);
    }

    public function contrasena(CambiarContrasenaPropia $request, RevocarSesiones $revocar)
    {
        DB::transaction(function () use ($request, $revocar): void {
            $cuenta = $this->bloquear($request);
            // * Revalidar dentro del bloqueo evita competir con un restablecimiento.
            abort_unless(Hash::check($request->validated('clave.current_password'), $cuenta->password), 409);
            $nueva = $request->validated('clave.password');
            if ($cuenta->cambio_clave_pendiente && Hash::check($nueva, $cuenta->password)) {
                throw ValidationException::withMessages(['clave.password' => 'Elige una contraseña distinta de la temporal.']);
            }
            $cuenta->password = $nueva;
            if ($cuenta->cambio_clave_pendiente) {
                $cuenta->cambio_clave_pendiente = false;
            }
            Password::broker()->deleteToken($cuenta);
            $revocar->ejecutar($cuenta);
            EventoDeCuenta::create(['actor_id' => $cuenta->id, 'cuenta_id' => $cuenta->id, 'accion' => 'cambiar-contrasena']);
        }, 3);
        Auth::guard('web')->logoutCurrentDevice();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent(headers: ['Cache-Control' => 'no-store']);
    }

    private function bloquear(Request $request): User
    {
        $cuenta = User::query()->lockForUpdate()->findOrFail($request->user()->id);
        abort_if($cuenta->version_sesion !== $request->user()->version_sesion, 401);
        Gate::forUser($cuenta)->authorize('editarPerfil', User::class);

        return $cuenta;
    }
}
