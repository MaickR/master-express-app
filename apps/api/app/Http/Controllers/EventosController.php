<?php

namespace App\Http\Controllers;

use App\Actions\ModificarEvento;
use App\Actions\ProgramarEvento;
use App\Http\Requests\ActualizarEvento;
use App\Http\Requests\CrearEvento;
use App\Http\Requests\ListarEventos;
use App\Http\Resources\CeremoniaResource;
use App\Http\Resources\EventoResource;
use App\Models\Evento;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class EventosController extends Controller
{
    public function index(ListarEventos $request): JsonResponse
    {
        $filtros = $request->validated();
        $hoy = Evento::fechaOperativa();
        request()->attributes->set('fecha_operativa', $hoy);
        $consulta = Evento::query()->with(['institucion', 'sede'])->withCount('ceremonias');
        if (isset($filtros['institucion_id'])) {
            $consulta->where('institucion_id', $filtros['institucion_id']);
        }
        if (isset($filtros['buscar'])) {
            $termino = $filtros['buscar'];
            if (ctype_digit($termino) && strlen($termino) <= 19) {
                $consulta->whereKey($termino);
            } else {
                $patron = '%'.addcslashes($termino, '%_\\').'%';
                $consulta->where(fn (Builder $eventos) => $eventos->whereLike('lugar', $patron)
                    ->orWhereHas('institucion', fn (Builder $instituciones) => $instituciones->whereLike('nombre', $patron))
                    ->orWhereHas('ceremonias', fn (Builder $ceremonias) => $ceremonias->whereLike('nombre', $patron)));
            }
        }
        if (isset($filtros['desde'])) {
            $consulta->where('fecha', '>=', $filtros['desde']);
        }
        if (isset($filtros['hasta'])) {
            $consulta->where('fecha', '<=', $filtros['hasta']);
        }
        if (($filtros['vista'] ?? null) === 'activa') {
            $consulta->whereNull('cancelado_en')->where('fecha', '>=', $hoy);
        }
        if (($filtros['vista'] ?? null) === 'historial') {
            $consulta->where(fn (Builder $eventos) => $eventos->whereNotNull('cancelado_en')->orWhere('fecha', '<', $hoy));
        }

        match ($filtros['estado'] ?? null) {
            'proximo' => $consulta->whereNull('cancelado_en')->where('fecha', '>', $hoy),
            'en_ejecucion' => $consulta->whereNull('cancelado_en')->where('fecha', $hoy),
            'finalizado' => $consulta->whereNull('cancelado_en')->where('fecha', '<', $hoy),
            'cancelado' => $consulta->whereNotNull('cancelado_en'),
            default => null,
        };

        $orden = ($filtros['vista'] ?? null) === 'activa' ? 'asc' : 'desc';

        return EventoResource::collection($consulta->orderBy('fecha', $orden)->orderBy('id', $orden)->paginate(25)->appends($filtros))
            ->additional(['fecha_operativa' => $hoy])->response()->header('Cache-Control', 'no-store');
    }

    public function store(CrearEvento $request, ProgramarEvento $programar): JsonResponse
    {
        $evento = $programar->ejecutar($request->user(), $request->validated('evento'));

        return $this->detalle($evento)->setStatusCode(201);
    }

    public function show(string $evento): JsonResponse
    {
        return $this->detalle($this->consultarEvento($evento));
    }

    public function update(ActualizarEvento $request, string $evento, ModificarEvento $modificar): JsonResponse
    {
        return $this->detalle($modificar->actualizar($request->user(), $evento, $request->validated('evento')));
    }

    public function cancelar(Request $request, string $evento, ModificarEvento $modificar): JsonResponse
    {
        return $this->detalle($modificar->cancelar($request->user(), $evento));
    }

    private function detalle(Evento $evento): JsonResponse
    {
        $evento->load(['institucion', 'sede', 'ceremonias.registros:id,ceremonia_id,programa_academico'])
            ->loadCount('ceremonias');

        return EventoResource::make($evento)->response()->header('Cache-Control', 'no-store');
    }

    public function ceremonias(string $evento): JsonResponse
    {
        $programacion = $this->consultarEvento($evento);

        return CeremoniaResource::collection($programacion->ceremonias()->get())
            ->response()->header('Cache-Control', 'no-store');
    }

    public function ceremonia(string $evento, string $ceremonia): JsonResponse
    {
        $programacion = $this->consultarEvento($evento);
        $sesion = $programacion->ceremonias()->find($ceremonia);
        abort_unless($sesion, 404, 'La ceremonia no existe en este evento.');

        return CeremoniaResource::make($sesion)->response()->header('Cache-Control', 'no-store');
    }

    private function consultarEvento(string $id): Evento
    {
        Gate::authorize('viewAny', Evento::class);
        $evento = Evento::query()->find($id);
        abort_unless($evento, 404, 'El evento no existe.');
        Gate::authorize('view', $evento);

        return $evento;
    }
}
