<?php

namespace App\Http\Controllers;

use App\Actions\ProgramarEvento;
use App\Http\Requests\CrearEvento;
use App\Http\Requests\ListarEventos;
use App\Http\Resources\CeremoniaResource;
use App\Http\Resources\EventoResource;
use App\Models\Evento;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class EventosController extends Controller
{
    public function index(ListarEventos $request): JsonResponse
    {
        $consulta = Evento::query()->with(['institucion', 'sede'])->withCount('ceremonias')
            ->orderByDesc('fecha')->orderByDesc('id');

        $institucionId = $request->validated('institucion_id');
        if ($institucionId !== null) {
            $consulta->where('institucion_id', $institucionId);
        }

        return EventoResource::collection($consulta->simplePaginate(25)->appends($request->validated()))
            ->response()->header('Cache-Control', 'no-store');
    }

    public function store(CrearEvento $request, ProgramarEvento $programar): JsonResponse
    {
        $evento = $programar->ejecutar($request->user(), $request->validated('evento'));
        $evento->load(['institucion', 'sede', 'ceremonias'])->loadCount('ceremonias');

        return EventoResource::make($evento)->response()->setStatusCode(201)
            ->header('Cache-Control', 'no-store');
    }

    public function show(string $evento): JsonResponse
    {
        $programacion = $this->consultarEvento($evento);
        $programacion->load(['institucion', 'sede', 'ceremonias'])->loadCount('ceremonias');

        return EventoResource::make($programacion)->response()->header('Cache-Control', 'no-store');
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
