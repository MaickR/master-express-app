<?php

namespace App\Actions;

use App\Actions\Autenticacion\DesafioDeCorreo;
use App\Models\SolicitudInstitucional;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RegistrarSolicitudInstitucional
{
    public const string CUENTA_EXISTENTE = 'Esta dirección ya tiene una cuenta. Inicia sesión para solicitar la representación.';

    public function __construct(private readonly DesafioDeCorreo $desafios) {}

    public function solicitarCodigo(string $correo, #[\SensitiveParameter] string $sesion): void
    {
        $this->rechazarCuentaExistente($correo);
        $this->desafios->solicitar(DesafioDeCorreo::INSTITUCION, $correo, $sesion, 'registro-institucion');
    }

    public function confirmar(string $correo, #[\SensitiveParameter] string $sesion, #[\SensitiveParameter] string $codigo): void
    {
        $this->rechazarCuentaExistente($correo);
        $this->desafios->confirmar(DesafioDeCorreo::INSTITUCION, $correo, $sesion, $codigo);
    }

    public function crear(#[\SensitiveParameter] array $datos, #[\SensitiveParameter] string $sesion): SolicitudInstitucional
    {
        $this->rechazarCuentaExistente($datos['email']);

        return $this->desafios->usarVerificacion(
            DesafioDeCorreo::INSTITUCION,
            $datos['email'],
            $sesion,
            fn (): SolicitudInstitucional => $this->guardar($datos, null, true),
            fn (): SolicitudInstitucional => $this->reintento($datos),
        );
    }

    public function representar(User $actor, #[\SensitiveParameter] array $datos): SolicitudInstitucional
    {
        return DB::transaction(function () use ($actor, $datos): SolicitudInstitucional {
            $titular = User::query()->lockForUpdate()->find($actor->id);
            abort_unless($titular, 401, 'Tu sesión terminó.');
            abort_if($titular->version_sesion !== $actor->version_sesion, 401, 'Tu sesión terminó.');
            abort_unless(
                $titular->activa && $titular->email_verified_at !== null,
                403,
                'La cuenta debe tener el correo verificado para solicitar la representación.',
            );
            $datos['email'] = $titular->email;

            return $this->guardar($datos, $titular, false);
        }, 3);
    }

    private function guardar(array $datos, ?User $titular, bool $activacion): SolicitudInstitucional
    {
        if ($titular === null && User::query()->where('email', $datos['email'])->lockForUpdate()->exists()) {
            throw ValidationException::withMessages(['email' => self::CUENTA_EXISTENTE]);
        }

        $previa = SolicitudInstitucional::query()->where('reserva_correo', $datos['email'])->lockForUpdate()->first();
        if ($previa) {
            return $this->mismaOConflicto($previa, $datos);
        }

        $solicitud = new SolicitudInstitucional;
        $solicitud->forceFill([
            'estado' => SolicitudInstitucional::PENDIENTE,
            'tipo' => $datos['tipo'],
            'razon_social' => $datos['razon_social'],
            'nit' => $datos['nit'],
            'sede_nombre' => $datos['sede'],
            'representante_nombre' => $datos['representante'],
            'email' => $datos['email'],
            'telefono' => $datos['telefono'],
            'huella_solicitud' => $this->huella($datos),
            'reserva_correo' => $datos['email'],
            'user_id' => $titular?->id,
            'correo_verificado_en' => $titular?->email_verified_at ?? now(),
            'requiere_activacion' => $activacion,
        ])->save();

        return $solicitud;
    }

    private function reintento(array $datos): SolicitudInstitucional
    {
        $previa = SolicitudInstitucional::query()->where('email', $datos['email'])
            ->where('estado', SolicitudInstitucional::PENDIENTE)->first();
        if ($previa === null || ! hash_equals($previa->huella_solicitud, $this->huella($datos))) {
            throw ValidationException::withMessages(['email' => 'Verifica el correo para continuar.']);
        }

        return $previa;
    }

    private function mismaOConflicto(SolicitudInstitucional $previa, array $datos): SolicitudInstitucional
    {
        abort_unless(
            $previa->estado === SolicitudInstitucional::PENDIENTE
            && hash_equals($previa->huella_solicitud, $this->huella($datos)),
            409,
            'Ya hay una solicitud institucional en curso para este correo.',
        );

        return $previa;
    }

    private function rechazarCuentaExistente(string $correo): void
    {
        if (User::query()->where('email', $correo)->exists()) {
            throw ValidationException::withMessages(['email' => self::CUENTA_EXISTENTE]);
        }
    }

    private function huella(array $datos): string
    {
        return hash('sha256', json_encode([
            $datos['tipo'], $datos['razon_social'], $datos['nit'], $datos['sede'],
            $datos['representante'], $datos['email'], $datos['telefono'],
        ], JSON_THROW_ON_ERROR));
    }
}
