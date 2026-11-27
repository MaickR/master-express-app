<?php

namespace App\Actions\Autenticacion;

use App\Models\Rol;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegistrarGraduando
{
    public const int VIGENCIA_MINUTOS = DesafioDeCorreo::VIGENCIA_MINUTOS;

    public function __construct(private readonly DesafioDeCorreo $desafios) {}

    public function solicitar(string $correo, #[\SensitiveParameter] string $sesion): void
    {
        $this->desafios->solicitar(DesafioDeCorreo::GRADUANDO, $correo, $sesion, 'registro-graduando');
    }

    public function puedeEnviar(string $correo, string $emision): bool
    {
        return $this->desafios->vigente(DesafioDeCorreo::GRADUANDO, $correo, $emision)
            && ! User::query()->where('email', $correo)->exists();
    }

    public function confirmar(
        string $correo, #[\SensitiveParameter] string $sesion, #[\SensitiveParameter] string $codigo,
    ): void {
        $this->desafios->confirmar(DesafioDeCorreo::GRADUANDO, $correo, $sesion, $codigo);
    }

    public function crear(#[\SensitiveParameter] array $datos, #[\SensitiveParameter] string $sesion): void
    {
        $this->desafios->usarVerificacion(
            DesafioDeCorreo::GRADUANDO,
            $datos['email'],
            $sesion,
            function () use ($datos): void {
                $this->guardarCuenta($datos);
            },
            function (): void {},
        );
    }

    private function guardarCuenta(#[\SensitiveParameter] array $datos): void
    {
        $cuentas = User::query()->where('email', $datos['email']);
        if ($cuentas->exists()) {
            return;
        }

        try {
            // Conserva la transacción externa si el índice único resolvió una carrera.
            $usuario = DB::transaction(fn (): User => tap(new User, function (User $usuario) use ($datos): void {
                $usuario->forceFill([
                    'name' => $datos['nombres'].' '.$datos['apellidos'],
                    'nombres' => $datos['nombres'], 'apellidos' => $datos['apellidos'],
                    'email' => $datos['email'], 'email_verified_at' => now(),
                    'telefono' => $datos['telefono'], 'password' => Hash::make($datos['password']),
                    'tipo_documento' => $datos['tipo_documento'] ?? null,
                    'numero_documento' => $datos['numero_documento'] ?? null,
                ])->save();
            }));
        } catch (UniqueConstraintViolationException $error) {
            if ($cuentas->lockForUpdate()->first(['id']) === null) {
                throw $error;
            }

            return;
        }

        $usuario->roles()->attach(Rol::query()->where('codigo', 'graduando')->sole(['id'])->id);
    }
}
