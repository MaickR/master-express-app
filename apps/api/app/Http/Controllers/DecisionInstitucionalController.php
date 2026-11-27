<?php

namespace App\Http\Controllers;

use App\Actions\DecidirSolicitudInstitucional;
use App\Http\Requests\CuerpoVacio;
use App\Http\Requests\RechazoInstitucional;
use App\Models\SolicitudInstitucional;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class DecisionInstitucionalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', SolicitudInstitucional::class);
        $estado = $request->query('estado', SolicitudInstitucional::PENDIENTE);
        abort_unless(is_string($estado) && in_array($estado, [
            SolicitudInstitucional::PENDIENTE,
            SolicitudInstitucional::APROBADA,
            SolicitudInstitucional::RECHAZADA,
        ], true), 422, 'El estado de la solicitud no es válido.');
        $consulta = SolicitudInstitucional::query()->where('estado', $estado);
        $consulta = $estado === SolicitudInstitucional::PENDIENTE
            ? $consulta->orderBy('id')
            : $consulta->orderByDesc('decidida_en')->orderByDesc('id');
        $pagina = $consulta->simplePaginate(25);

        return response()->json([
            'data' => $pagina->getCollection()->map(fn (SolicitudInstitucional $solicitud): array => $solicitud->resumen())->values(),
            'hayMas' => $pagina->hasMorePages(),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function decisiones(): JsonResponse
    {
        Gate::authorize('viewAny', SolicitudInstitucional::class);
        $pagina = SolicitudInstitucional::query()->whereNotNull('decidida_en')
            ->with('responsable')->orderByDesc('decidida_en')->orderByDesc('id')->simplePaginate(25);

        return response()->json([
            'data' => $pagina->getCollection()->map(fn (SolicitudInstitucional $solicitud): array => [
                'id' => $solicitud->id,
                'estado' => $solicitud->estado,
                'tipo' => $solicitud->tipo,
                'razon_social' => $solicitud->razon_social,
                'nit' => $solicitud->nit,
                'sede' => $solicitud->sede_nombre,
                'email' => $solicitud->email,
                'en' => $solicitud->decidida_en?->toIso8601String(),
                'administrador' => [
                    'id' => $solicitud->decidida_por,
                    'nombre' => $solicitud->responsable?->name,
                ],
                'motivo' => $solicitud->motivo_rechazo,
            ])->values(),
            'hayMas' => $pagina->hasMorePages(),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function show(int $solicitud): JsonResponse
    {
        Gate::authorize('viewAny', SolicitudInstitucional::class);
        $fila = SolicitudInstitucional::query()->find($solicitud);
        abort_unless($fila, 404, 'La solicitud no existe.');

        return response()->json(['data' => $fila->detalle()], headers: ['Cache-Control' => 'no-store']);
    }

    public function aprobar(CuerpoVacio $request, int $solicitud, DecidirSolicitudInstitucional $decision): JsonResponse
    {
        $fila = $decision->aprobar($request->user(), $solicitud);

        return response()->json(['data' => $fila->detalle()], headers: ['Cache-Control' => 'no-store']);
    }

    public function rechazar(RechazoInstitucional $request, int $solicitud, DecidirSolicitudInstitucional $decision): JsonResponse
    {
        $fila = $decision->rechazar($request->user(), $solicitud, $request->validated('motivo'));

        return response()->json(['data' => $fila->detalle()], headers: ['Cache-Control' => 'no-store']);
    }

    public function notificar(CuerpoVacio $request, int $solicitud, DecidirSolicitudInstitucional $decision): Response
    {
        $decision->reintentar($request->user(), $solicitud);

        return response()->noContent(202, ['Cache-Control' => 'no-store']);
    }
}
