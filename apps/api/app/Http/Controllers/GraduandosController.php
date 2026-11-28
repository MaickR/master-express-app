<?php

namespace App\Http\Controllers;

use App\Actions\GuardarGraduandoOperativo;
use App\Http\Requests\GuardarGraduando;
use App\Http\Requests\ListarGraduandos;
use App\Models\Evento;
use App\Models\Graduando;
use App\Policies\GraduandoPolicy;
use App\Policies\RegistroPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class GraduandosController extends Controller
{
    public function index(ListarGraduandos $request, GraduandoPolicy $politica, RegistroPolicy $registros): JsonResponse
    {
        $consulta = $politica->consulta($request->user())->withExists(['vinculos as vinculado' => fn ($vinculos) => $vinculos->where('estado', 'activo')]);
        $buscar = trim((string) $request->validated('buscar', ''));
        if ($buscar !== '') {
            $consulta->where(function ($filtro) use ($buscar): void {
                $patron = '%'.addcslashes($buscar, '%_\\').'%';
                $filtro->where('nombre_completo', 'like', $patron)->orWhere('correo', 'like', $patron)->orWhere('numero_documento', $buscar);
            });
        }
        $estado = $request->validated('vinculacion');
        if ($estado !== null) {
            $vinculos = fn ($vinculo) => $vinculo->where('estado', 'activo');
            $estado === 'activa' ? $consulta->whereHas('vinculos', $vinculos) : $consulta->whereDoesntHave('vinculos', $vinculos);
        }
        $filtros = $request->safe()->only(['evento_id', 'ceremonia_id', 'institucion_id', 'sede_id']);
        if ($filtros !== []) {
            // * El mismo registro autorizado debe satisfacer todos los filtros.
            $inscripciones = $registros->consulta($request->user());
            foreach ($filtros as $campo => $valor) {
                if ($campo === 'ceremonia_id') {
                    $inscripciones->where($campo, $valor);
                } else {
                    $inscripciones->whereHas('ceremonia.evento', fn ($eventos) => $eventos->where($campo === 'evento_id' ? 'id' : $campo, $valor));
                }
            }
            $consulta->whereIn('id', $inscripciones->select('graduando_id'));
        }
        $pagina = $consulta->latest('id')->paginate(25);
        $rolGestion = $politica->rolDeGestion($request->user());

        return response()->json(['data' => $pagina->getCollection()->map(fn ($fila) => $this->recurso($fila, $request, $politica->permiteEditar($request->user(), $fila, $rolGestion))),
            'total' => $pagina->total(), 'hayMas' => $pagina->hasMorePages()], headers: ['Cache-Control' => 'no-store']);
    }

    public function show(Request $request, string $graduando, GraduandoPolicy $politica): JsonResponse
    {
        $fila = $politica->consulta($request->user())->findOrFail($graduando);

        return response()->json(['data' => $this->recurso($fila, $request)], headers: ['Cache-Control' => 'no-store']);
    }

    public function store(GuardarGraduando $request, GuardarGraduandoOperativo $guardar): JsonResponse
    {
        $fila = $guardar->ejecutar($request->user(), $request->validated('graduando'));

        return response()->json(['data' => $this->recurso($fila, $request)], 201, ['Cache-Control' => 'no-store']);
    }

    public function update(GuardarGraduando $request, string $graduando, GuardarGraduandoOperativo $guardar): JsonResponse
    {
        $fila = $guardar->ejecutar($request->user(), $request->validated('graduando'), (int) $graduando);

        return response()->json(['data' => $this->recurso($fila, $request)], headers: ['Cache-Control' => 'no-store']);
    }

    public function filtros(Request $request, RegistroPolicy $registros): JsonResponse
    {
        $ceremonias = $registros->consulta($request->user())->select('ceremonia_id');
        $eventos = Evento::query()->whereHas('ceremonias', fn ($consulta) => $consulta->whereIn('id', $ceremonias))
            ->with(['institucion', 'sede', 'ceremonias'])->orderByDesc('fecha')->get();

        return response()->json(['data' => $eventos->map(fn ($evento) => [
            'id' => $evento->id, 'nombre' => $evento->institucion->nombre.' · '.$evento->fecha->format('Y-m-d'),
            'institucion' => ['id' => $evento->institucion->id, 'nombre' => $evento->institucion->nombre],
            'sede' => $evento->sede ? ['id' => $evento->sede->id, 'nombre' => $evento->sede->nombre] : null,
            'ceremonias' => $evento->ceremonias->map(fn ($fila) => ['id' => $fila->id, 'nombre' => $fila->nombre]),
        ])], headers: ['Cache-Control' => 'no-store']);
    }

    public function programacion(Request $request): JsonResponse
    {
        Gate::authorize('create', Graduando::class);
        $request->validate(['page' => ['sometimes', 'integer', 'between:1,2147483647']]);
        $pagina = Evento::query()->whereNull('cancelado_en')
            ->with(['institucion', 'sede', 'ceremonias'])->orderBy('fecha')->orderBy('id')->simplePaginate(25);

        return response()->json(['data' => $pagina->getCollection()->map(fn ($evento) => [
            'id' => $evento->id, 'nombre' => $evento->institucion->nombre.' · '.$evento->fecha->format('Y-m-d').' · '.($evento->sede?->nombre ?? 'Sin sede'),
            'ceremonias' => $evento->ceremonias->map(fn ($ceremonia) => ['id' => $ceremonia->id, 'nombre' => $ceremonia->nombre]),
        ]), 'hayMas' => $pagina->hasMorePages()], headers: ['Cache-Control' => 'no-store']);
    }

    private function recurso(Graduando $fila, Request $request, ?bool $puedeEditar = null): array
    {
        return ['id' => $fila->id, 'nombre_completo' => $fila->nombre_completo,
            'tipo_documento' => $fila->tipo_documento, 'numero_documento' => $fila->numero_documento,
            'correo' => $fila->correo, 'telefono' => $fila->telefono, 'revision' => $fila->revision,
            'puede_editar' => $puedeEditar ?? Gate::forUser($request->user())->allows('update', $fila),
            'vinculado' => isset($fila->vinculado) ? (bool) $fila->vinculado : $fila->vinculos()->where('estado', 'activo')->exists()];
    }
}
