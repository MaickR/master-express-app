<?php

namespace App\Http\Controllers;

use App\Actions\InscribirGraduando;
use App\Http\Requests\CrearRegistro;
use App\Http\Requests\ListarRegistros;
use App\Http\Resources\RegistroResource;
use App\Policies\RegistroPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class RegistrosController extends Controller
{
    public function index(ListarRegistros $request, RegistroPolicy $policy): JsonResponse
    {
        $consulta = $policy->consulta($request->user())->with(['graduando', 'ceremonia'])->latest('id');

        if ($request->validated('graduando_id') !== null) {
            $consulta->where('graduando_id', $request->validated('graduando_id'));
        }

        if ($request->validated('ceremonia_id') !== null) {
            $consulta->where('ceremonia_id', $request->validated('ceremonia_id'));
        }

        if ($request->validated('evento_id') !== null) {
            $consulta->whereRelation('ceremonia', 'evento_id', $request->validated('evento_id'));
        }

        return RegistroResource::collection($consulta->simplePaginate(25)->appends($request->validated()))
            ->response()->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, string $registro, RegistroPolicy $policy): JsonResponse
    {
        $inscripcion = $policy->consulta($request->user())->find($registro);
        abort_unless($inscripcion, 404, 'El registro no existe en el ámbito de la cuenta.');
        Gate::authorize('view', $inscripcion);

        return RegistroResource::make($inscripcion->load(['graduando', 'ceremonia']))
            ->response()->header('Cache-Control', 'no-store');
    }

    public function store(CrearRegistro $request, string $ceremonia, InscribirGraduando $inscribir): JsonResponse
    {
        $registro = $inscribir->ejecutar($request->user(), $ceremonia, $request->validated('registro'));

        return RegistroResource::make($registro->load(['graduando', 'ceremonia']))
            ->response()->setStatusCode(201)->header('Cache-Control', 'no-store');
    }
}
