<?php

namespace App\Actions\Autenticacion;

use App\Jobs\EnviarCodigoDeRegistro;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DesafioDeCorreo
{
    public const int VIGENCIA_MINUTOS = 10;

    public const string GRADUANDO = 'registro-graduando';

    public const string INSTITUCION = 'registro-institucion';

    private const int VIGENCIA = self::VIGENCIA_MINUTOS * 60;

    public function solicitar(string $proposito, string $correo, #[\SensitiveParameter] string $sesion, string $cola): void
    {
        $this->exigirColaDeIdentidad();
        $clave = $this->huella($proposito, 'correo', $correo);
        $contexto = $this->huella($proposito, 'sesion', $sesion);

        DB::transaction(function () use ($proposito, $correo, $clave, $contexto, $cola): void {
            $emision = (string) Str::uuid();
            DB::table('desafios_de_registro')->upsert([[
                'clave' => $clave, 'contexto' => $contexto, 'emision' => $emision,
                'estado' => 'pendiente', 'reenviar_desde' => 0, 'vence_en' => 0,
            ]], ['clave'], ['clave']);

            $consulta = $this->fila($clave);
            $anterior = $consulta->lockForUpdate()->first();
            $ahora = now()->timestamp;
            if ($anterior->reenviar_desde > $ahora) {
                $this->esperar($anterior->reenviar_desde - $ahora);
            }

            do {
                $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            } while ($anterior->codigo_hmac !== null && hash_equals(
                $anterior->codigo_hmac,
                $this->huella($proposito, 'codigo', $clave, $anterior->contexto, $anterior->emision, $codigo),
            ));

            $consulta->update([
                'contexto' => $contexto, 'emision' => $emision, 'estado' => 'pendiente',
                'reenviar_desde' => $ahora + 60, 'vence_en' => $ahora + self::VIGENCIA,
                'intentos' => 0, 'codigo_hmac' => $this->huella($proposito, 'codigo', $clave, $contexto, $emision, $codigo),
            ]);

            Bus::dispatch((new EnviarCodigoDeRegistro($correo, $emision, $codigo, $proposito))
                ->onConnection('database')->onQueue($cola)->beforeCommit());
        }, 3);
    }

    public function vigente(string $proposito, string $correo, string $emision): bool
    {
        return $this->fila($this->huella($proposito, 'correo', $correo))
            ->where('emision', $emision)->where('estado', 'pendiente')->where('vence_en', '>', now()->timestamp)
            ->exists();
    }

    public function confirmar(
        string $proposito, string $correo, #[\SensitiveParameter] string $sesion, #[\SensitiveParameter] string $codigo,
    ): void {
        $clave = $this->huella($proposito, 'correo', $correo);
        $contexto = $this->huella($proposito, 'sesion', $sesion);
        $confirmado = DB::transaction(function () use ($proposito, $clave, $contexto, $codigo): bool {
            $consulta = $this->fila($clave)->where('contexto', $contexto);
            $desafio = $consulta->lockForUpdate()->first();
            $ahora = now()->timestamp;
            if ($desafio === null || $desafio->estado !== 'pendiente' || $desafio->vence_en <= $ahora) {
                return false;
            }
            if ($desafio->intentos >= 5) {
                $this->esperar($desafio->vence_en - $ahora);
            }
            if (! hash_equals($desafio->codigo_hmac, $this->huella($proposito, 'codigo', $clave, $contexto, $desafio->emision, $codigo))) {
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

    public function usarVerificacion(
        string $proposito, string $correo, #[\SensitiveParameter] string $sesion, \Closure $alCrear, \Closure $siConsumido,
    ): mixed {
        $clave = $this->huella($proposito, 'correo', $correo);
        $contexto = $this->huella($proposito, 'sesion', $sesion);

        return DB::transaction(function () use ($clave, $contexto, $alCrear, $siConsumido): mixed {
            $consulta = $this->fila($clave)->where('contexto', $contexto);
            $desafio = $consulta->lockForUpdate()->first();
            if ($desafio === null || $desafio->estado === 'pendiente' || $desafio->vence_en <= now()->timestamp) {
                throw ValidationException::withMessages(['email' => 'Verifica el correo para continuar.']);
            }
            if ($desafio->estado === 'consumido') {
                return $siConsumido();
            }
            if ($desafio->estado !== 'verificado') {
                throw ValidationException::withMessages(['email' => 'Verifica el correo para continuar.']);
            }

            $resultado = $alCrear();
            $consulta->update(['estado' => 'consumido']);

            return $resultado;
        }, 3);
    }

    public function exigirColaDeIdentidad(): void
    {
        $conexionCola = config('queue.connections.database.connection') ?? DB::getDefaultConnection();
        if ($conexionCola !== DB::getDefaultConnection() || config('queue.connections.database.driver') !== 'database') {
            throw new \LogicException('La cola de registro debe usar la base de identidad.');
        }
    }

    private function fila(string $clave): Builder
    {
        return DB::table('desafios_de_registro')->where('clave', $clave);
    }

    private function huella(string $proposito, string $uso, #[\SensitiveParameter] string ...$partes): string
    {
        return hash_hmac('sha256', implode("\0", [$proposito, $uso, ...$partes]), app('encrypter')->getKey());
    }

    private function esperar(int $segundos): never
    {
        abort(429, 'Espera antes de volver a intentarlo.', ['Retry-After' => (string) $segundos]);
    }
}
