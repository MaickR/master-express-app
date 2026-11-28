<?php

namespace App\Http\Controllers;

use App\Http\Resources\InstitucionResource;
use App\Models\Evento;
use App\Models\Institucion;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class InstitucionesController extends Controller
{
    public function index(): JsonResponse
    {
        // * Comparte la concesión del ensayo de programación hasta aprobar el alcance institucional por rol.
        Gate::authorize('viewAny', Evento::class);

        return InstitucionResource::collection(Institucion::query()
            ->with(['sedes' => fn ($sedes) => $sedes->select('id', 'institucion_id', 'nombre')->orderBy('nombre')->orderBy('id')])
            ->orderBy('nombre')->orderBy('id')->get())
            ->response()->header('Cache-Control', 'no-store');
    }
}
