<?php

namespace App\Actions\Autenticacion;

use App\Jobs\EnviarCodigoDeRegistro;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RegistrarGraduando
{
    public const int VIGENCIA_MINUTOS = 10;

    private const int VIGENCIA = self::VIGENCIA_MINUTOS * 60;

    public function solicitar(string $correo, #[\SensitiveParameter] string $sesion): void
    {
        $clave = $this->huella('correo', $correo);
        $contexto = $this->huella('sesion', $sesion);

        DB::transaction(function () use ($correo, $clave, $contexto): void {
            $emision = (string) Str::uuid();
            DB::table('desafios_de_registro')->upsert([[
                'clave' => $clave, 'contexto' => $contexto, 'emision' => $emision,
                'estado' => 'pendiente', 'reenviar_desde' => 0, 'vence_en' => 0,
            ]], ['clave'], ['clave']);

            $consulta = $this->desafio($clave);
            $anterior = $consulta->lockForUpdate()->first();
            $ahora = now()->timestamp;
            if ($anterior->reenviar_desde > $ahora) {
                $this->esperar($anterior->reenviar_desde - $ahora);
            }

            do {
                $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            } while ($anterior->codigo_hmac !== null && hash_equals(
                $anterior->codigo_hmac,
                $this->huella('codigo', $clave, $anterior->contexto, $anterior->emision, $codigo),
            ));

            $consulta->update([
                'contexto' => $contexto, 'emision' => $emision, 'estado' => 'pendiente',
                'reenviar_desde' => $ahora + 60, 'vence_en' => $ahora + self::VIGENCIA,
                'intentos' => 0, 'codigo_hmac' => $this->huella('codigo', $clave, $contexto, $emision, $codigo),
            ]);

            // La cola se escribe en la misma conexión y se confirma con el desafío.
            $conexionCola = config('queue.connections.database.connection') ?? DB::getDefaultConnection();
            if ($conexionCola !== DB::getDefaultConnection() || config('queue.connections.database.driver') !== 'database') {
                throw new \LogicException('La cola de registro debe usar la base de identidad.');
            }
            Bus::dispatch((new EnviarCodigoDeRegistro($correo, $emision, $codigo))
                ->onConnection('database')->onQueue('registro-graduando')->beforeCommit());
        }, 3);
    }

    public function puedeEnviar(string $correo, string $emision): bool
    {
        return $this->desafio($this->huella('correo', $correo))
            ->where('emision', $emision)->where('estado', 'pendiente')->where('vence_en', '>', now()->timestamp)
            ->exists()
            && ! User::query()->where('email', $correo)->exists();
    }

    public function confirmar(
        string $correo, #[\SensitiveParameter] string $sesion, #[\SensitiveParameter] string $codigo,
    ): void {
        $clave = $this->huella('correo', $correo);
        $contexto = $this->huella('sesion', $sesion);
        $confirmado = DB::transaction(function () use ($clave, $contexto, $codigo): bool {
            $consulta = $this->desafio($clave)->where('contexto', $contexto);
            $desafio = $consulta->lockForUpdate()->first();
            $ahora = now()->timestamp;
            if ($desafio === null || $desafio->estado !== 'pendiente' || $desafio->vence_en <= $ahora) {
                return false;
            }
            if ($desafio->intentos >= 5) {
                $this->esperar($desafio->vence_en - $ahora);
            }
            if (! hash_equals($desafio->codigo_hmac, $this->huella('codigo', $clave, $contexto, $desafio->emision, $codigo))) {
                $consulta->increment('intentos');

                return false;
            }

            $consulta->update([
                'estado' => 'verificado', 'codigo_hmac' => null, 'vence_en' => $ahora + self::VIGENCIA,
            ]);

            return true;
        }, 3);

        if (! $confirmado) {
            throw ValidationException::withMessages(['codigo' => 'El código no es válido o venció. Solicita uno nuevo.']);
        }
    }

    public function crear(#[\SensitiveParameter] array $datos, #[\SensitiveParameter] string $sesion): void
    {
        $consulta = $this->desafio($this->huella('correo', $datos['email']))
            ->where('contexto', $this->huella('sesion', $sesion));

        DB::transaction(function () use ($consulta, $datos): void {
            $desafio = $consulta->lockForUpdate()->first();
            if ($desafio === null || $desafio->estado === 'pendiente' || $desafio->vence_en <= now()->timestamp) {
                throw ValidationException::withMessages(['email' => 'Verifica el correo para continuar.']);
            }
            if ($desafio->estado === 'consumido') {
                return;
            }

            $this->guardarCuenta($datos);
            $consulta->update(['estado' => 'consumido']);
        }, 3);
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

    private function desafio(string $clave): Builder
    {
        return DB::table('desafios_de_registro')->where('clave', $clave);
    }

    private function huella(string $uso, #[\SensitiveParameter] string ...$partes): string
    {
        return hash_hmac('sha256', implode("\0", ['registro-graduando', $uso, ...$partes]), app('encrypter')->getKey());
    }

    private function esperar(int $segundos): never
    {
        abort(429, 'Espera antes de volver a intentarlo.', ['Retry-After' => (string) $segundos]);
    }
}
