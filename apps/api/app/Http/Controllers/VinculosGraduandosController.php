<?php

namespace App\Http\Controllers;

use App\Actions\VincularGraduando;
use App\Http\Requests\AnularVinculoGraduando;
use App\Http\Requests\CorregirVinculoGraduando;
use App\Http\Requests\CrearVinculoGraduando;
use App\Http\Requests\ListarVinculosGraduandos;
use App\Models\Graduando;
use App\Models\User;
use App\Models\VinculoGraduando;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class VinculosGraduandosController extends Controller
{
    public function graduandos(ListarVinculosGraduandos $request): JsonResponse
    {
        $consulta = Graduando::query()->with(['vinculos.cuenta:id,name,email']);
        $buscar = trim((string) $request->validated('buscar', ''));
        if ($buscar !== '') {
            $consulta->where(function ($filtro) use ($buscar): void {
                $filtro->where('nombre_completo', 'like', '%'.addcslashes($buscar, '%_\\').'%');
                if (ctype_digit($buscar)) {
                    $filtro->orWhere('id', $buscar);
                }
            });
        }
        $estado = $request->validated('vinculacion');
        if ($estado !== null) {
            $relacion = fn ($vinculos) => $vinculos->where('estado', VinculoGraduando::ACTIVO);
            $estado === 'activa'
                ? $consulta->whereHas('vinculos', $relacion)
                : $consulta->whereDoesntHave('vinculos', $relacion);
        }
        $pagina = $consulta->orderBy('id')->simplePaginate(25);
        $homonimos = $this->homonimos($pagina->getCollection()->pluck('nombre_completo'));

        return response()->json([
            'data' => $pagina->getCollection()->map(function (Graduando $graduando) use ($homonimos): array {
                $activo = $graduando->vinculos->first(fn (VinculoGraduando $vinculo): bool => $vinculo->estado === VinculoGraduando::ACTIVO);

                return [
                    'id' => $graduando->id,
                    'nombre_completo' => $graduando->nombre_completo,
                    'homonimo' => $homonimos[$this->clave($graduando->nombre_completo)] ?? false,
                    'vinculo' => $activo instanceof VinculoGraduando ? $this->resumen($activo) : null,
                    'anteriores' => $graduando->vinculos
                        ->filter(fn (VinculoGraduando $vinculo): bool => $vinculo->estado === VinculoGraduando::ANULADO)
                        ->map(fn (VinculoGraduando $vinculo): array => $this->resumen($vinculo))
                        ->values(),
                ];
            })->values(),
            'hayMas' => $pagina->hasMorePages(),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function cuentas(ListarVinculosGraduandos $request): JsonResponse
    {
        $consulta = User::query()
            ->select(['id', 'name', 'email'])
            ->conAccesoEfectivoDeGraduando()
            ->whereDoesntHave('vinculosDeGraduando', fn ($vinculos) => $vinculos->where('estado', VinculoGraduando::ACTIVO));
        $buscar = trim((string) $request->validated('buscar', ''));
        if ($buscar !== '') {
            $consulta->where(function ($filtro) use ($buscar): void {
                $patron = '%'.addcslashes($buscar, '%_\\').'%';
                $filtro->where('name', 'like', $patron)->orWhere('email', 'like', $patron);
                if (ctype_digit($buscar)) {
                    $filtro->orWhere('id', $buscar);
                }
            });
        }
        $pagina = $consulta->orderBy('id')->simplePaginate(25);

        return response()->json([
            'data' => $pagina->getCollection()->map(fn (User $cuenta): array => [
                'id' => $cuenta->id,
                'nombre' => $cuenta->name,
                'correo' => $cuenta->email,
            ])->values(),
            'hayMas' => $pagina->hasMorePages(),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function store(CrearVinculoGraduando $request, VincularGraduando $vincular): JsonResponse
    {
        $actor = $request->user();
        $datos = $request->validated('vinculo');
        abort_unless($actor instanceof User && is_array($datos), 401, 'Tu sesión terminó.');
        $vinculo = $vincular->ejecutar($actor, (int) $datos['graduando_id'], (int) $datos['cuenta_id']);

        return response()->json([
            'data' => $this->recurso($vinculo),
        ], 201, ['Cache-Control' => 'no-store']);
    }

    public function anular(AnularVinculoGraduando $request, string $vinculo, VincularGraduando $vincular): JsonResponse
    {
        $actor = $request->user();
        $datos = $request->validated('correccion');
        abort_unless($actor instanceof User && is_array($datos), 401, 'Tu sesión terminó.');
        $fila = $vincular->anular($actor, (int) $vinculo, (string) $datos['motivo']);
        $fila->load('cuenta');

        return response()->json([
            'data' => $this->resumen($fila),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function corregir(CorregirVinculoGraduando $request, string $vinculo, VincularGraduando $vincular): JsonResponse
    {
        $actor = $request->user();
        $datos = $request->validated('correccion');
        abort_unless($actor instanceof User && is_array($datos), 401, 'Tu sesión terminó.');
        $anterior = VinculoGraduando::query()->with('cuenta')->find((int) $vinculo);
        $nuevo = $vincular->corregir($actor, (int) $vinculo, (int) $datos['cuenta_id'], (string) $datos['motivo']);
        $nuevo->load(['graduando', 'cuenta', 'administrador']);

        return response()->json([
            'data' => $this->recurso($nuevo),
            'anterior' => [
                'id' => $anterior?->id,
                'estado' => VinculoGraduando::ANULADO,
                'cuenta_id' => $anterior?->user_id,
                'cuenta_nombre' => $anterior?->cuenta?->name,
                'graduando_id' => $anterior?->graduando_id,
            ],
        ], 201, ['Cache-Control' => 'no-store']);
    }

    /**
     * @param  Collection<int, string>  $nombres
     * @return array<string, bool>
     */
    private function homonimos(Collection $nombres): array
    {
        $distintos = $nombres->filter(fn ($nombre): bool => is_string($nombre) && $nombre !== '')->unique()->values();
        if ($distintos->isEmpty()) {
            return [];
        }

        $conteos = Graduando::query()
            ->selectRaw('nombre_completo, count(*) as total')
            ->whereIn('nombre_completo', $distintos->all())
            ->groupBy('nombre_completo')
            ->pluck('total', 'nombre_completo');
        $marcas = [];
        foreach ($conteos as $nombre => $total) {
            $marcas[$this->clave((string) $nombre)] = (int) $total > 1;
        }

        return $marcas;
    }

    private function esHomonimo(string $nombre): bool
    {
        return Graduando::query()->where('nombre_completo', $nombre)->count() > 1;
    }

    private function clave(string $nombre): string
    {
        return mb_strtolower(trim($nombre));
    }

    /** @return array<string, mixed> */
    private function resumen(VinculoGraduando $vinculo): array
    {
        return [
            'id' => $vinculo->id,
            'estado' => $vinculo->estado,
            'cuenta_id' => $vinculo->user_id,
            'cuenta_nombre' => $vinculo->cuenta?->name,
            'cuenta_correo' => $vinculo->cuenta?->email,
            'decidida_en' => $vinculo->decidida_en?->toIso8601String(),
            'anulado_en' => $vinculo->anulado_en?->toIso8601String(),
            'motivo' => $vinculo->motivo_anulacion,
        ];
    }

    /** @return array<string, mixed> */
    private function recurso(VinculoGraduando $vinculo): array
    {
        $graduando = $vinculo->graduando;
        $cuenta = $vinculo->cuenta;
        $administrador = $vinculo->administrador;
        abort_unless($graduando && $cuenta && $administrador, 500, 'No se pudo confirmar la vinculación.');

        return [
            'id' => $vinculo->id,
            'estado' => $vinculo->estado,
            'graduando' => [
                'id' => $graduando->id,
                'nombre_completo' => $graduando->nombre_completo,
                'homonimo' => $this->esHomonimo($graduando->nombre_completo),
            ],
            'cuenta' => [
                'id' => $cuenta->id,
                'nombre' => $cuenta->name,
                'correo' => $cuenta->email,
            ],
            'decidida_en' => $vinculo->decidida_en?->toIso8601String(),
            'administrador' => [
                'id' => $administrador->id,
                'nombre' => $administrador->name,
            ],
        ];
    }
}
