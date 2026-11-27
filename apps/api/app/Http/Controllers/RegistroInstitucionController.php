<?php

namespace App\Http\Controllers;

use App\Actions\ActivarRepresentanteInstitucional;
use App\Actions\RegistrarSolicitudInstitucional;
use App\Http\Requests\ActivacionInstitucional;
use App\Http\Requests\SolicitudRegistroInstitucion;
use App\Http\Requests\SolicitudRepresentacionInstitucion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class RegistroInstitucionController extends Controller
{
    public function solicitar(SolicitudRegistroInstitucion $request, RegistrarSolicitudInstitucional $registro): Response
    {
        $registro->solicitarCodigo($request->validated('email'), $request->session()->getId());

        return response()->noContent(202, ['Cache-Control' => 'no-store']);
    }

    public function confirmar(SolicitudRegistroInstitucion $request, RegistrarSolicitudInstitucional $registro): Response
    {
        $registro->confirmar(
            $request->validated('email'), $request->session()->getId(), $request->validated('codigo'),
        );

        return response()->noContent(204, ['Cache-Control' => 'no-store']);
    }

    public function crear(SolicitudRegistroInstitucion $request, RegistrarSolicitudInstitucional $registro): JsonResponse
    {
        $solicitud = $registro->crear($request->validated(), $request->session()->getId());

        return response()->json(['data' => $solicitud->resumen()], 201, ['Cache-Control' => 'no-store']);
    }

    public function representar(SolicitudRepresentacionInstitucion $request, RegistrarSolicitudInstitucional $registro): JsonResponse
    {
        $solicitud = $registro->representar($request->user(), $request->validated());

        return response()->json(['data' => $solicitud->resumen()], 201, ['Cache-Control' => 'no-store']);
    }

    public function activar(ActivacionInstitucional $request, ActivarRepresentanteInstitucional $activacion): JsonResponse|Response
    {
        if (! $activacion->ejecutar($request->validated())) {
            return response()->json([
                'errors' => ['token' => ['El enlace no es válido o venció. Solicita uno nuevo.']],
                'message' => 'El enlace no es válido o venció. Solicita uno nuevo.',
            ], 422, ['Cache-Control' => 'no-store']);
        }

        return response()->noContent(204, ['Cache-Control' => 'no-store']);
    }
}
