<?php

namespace App\Http\Controllers;

use App\Models\VinculoInstitucional;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MiInstitucionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $usuario = $request->user();
        abort_unless(
            $usuario->activa && $usuario->email_verified_at !== null
            && $usuario->roles()->where('codigo', 'institucion')->exists(),
            403,
            'La cuenta no tiene un acceso institucional activo.',
        );

        $vinculos = $usuario->vinculosInstitucionales()
            ->where('estado', VinculoInstitucional::ACTIVO)
            ->with(['institucion', 'sede', 'solicitud'])
            ->orderBy('id')
            ->get();
        abort_if($vinculos->isEmpty(), 403, 'La cuenta no tiene un vínculo institucional activo.');

        return response()->json([
            'data' => $vinculos->map(fn (VinculoInstitucional $vinculo): array => [
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
}
