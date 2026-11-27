<?php

namespace App\Http\Controllers;

use App\Http\Resources\EventoResource;
use App\Models\Evento;
use App\Models\VinculoInstitucional;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MiInstitucionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $vinculos = $this->vinculosAutorizados($request)
            ->with(['institucion', 'sede', 'solicitud'])
            ->orderBy('id')
            ->get();
        abort_if($vinculos->isEmpty(), 403, 'La cuenta no tiene un vínculo institucional activo.');

        return response()->json([
            'data' => $vinculos->map(fn (VinculoInstitucional $vinculo): array => [
                'vinculo_id' => $vinculo->id,
                'institucion_id' => $vinculo->institucion_id,
                'nombre' => $vinculo->institucion?->nombre,
                'tipo' => $vinculo->institucion?->tipo,
                'nit' => $vinculo->institucion?->nit,
                'sede' => $vinculo->sede ? [
                    'id' => $vinculo->sede->id,
                    'nombre' => $vinculo->sede->nombre,
                ] : null,
                'representante' => $vinculo->solicitud?->representante_nombre,
                'correo' => $usuario->email,
                'correo_verificado' => $usuario->email_verified_at !== null,
            ])->values(),
        ], headers: ['Cache-Control' => 'no-store']);
    }

    public function eventos(Request $request, string $vinculo): JsonResponse
    {
        $consulta = $this->programacion($request, $vinculo);
        $request->validate(['page' => ['sometimes', 'required', 'integer', 'between:1,2147483647']]);

        $eventos = $consulta->orderByDesc('fecha')->orderByDesc('id')->simplePaginate(25);

        return EventoResource::collection($eventos)->response()->header('Cache-Control', 'no-store');
    }

    public function evento(Request $request, string $vinculo, string $evento): JsonResponse
    {
        $programacion = $this->programacion($request, $vinculo)->find($evento);
        abort_unless($programacion, 404, 'El evento no está disponible en este ámbito.');

        return EventoResource::make($programacion)->response()->header('Cache-Control', 'no-store');
    }

    /** @return Builder<VinculoInstitucional> */
    private function vinculosAutorizados(Request $request): Builder
    {
        Gate::authorize('viewAny', VinculoInstitucional::class);

        return $request->user()->vinculosInstitucionales()->getQuery()
            ->where('estado', VinculoInstitucional::ACTIVO)
            ->whereHas('sede', fn (Builder $sede) => $sede
                ->whereColumn('sedes.institucion_id', 'vinculos_institucionales.institucion_id'));
    }

    /** @return Builder<Evento> */
    private function programacion(Request $request, string $id): Builder
    {
        $vinculo = $this->vinculosAutorizados($request)->find($id);
        abort_unless($vinculo, 403, 'La cuenta no tiene un vínculo activo para este ámbito.');

        // * Un evento sin sede confirmada queda fuera del ámbito de un vínculo con sede.
        return Evento::query()
            ->where('institucion_id', $vinculo->institucion_id)
            ->where('sede_id', $vinculo->sede_id)
            ->with(['institucion', 'sede', 'ceremonias'])
            ->withCount('ceremonias');
    }
}
