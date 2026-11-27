<?php

namespace App\Http\Controllers;

use App\Actions\Autenticacion\RegistrarGraduando;
use App\Http\Requests\SolicitudRegistroGraduando;
use Illuminate\Http\Response;

class RegistroGraduandoController extends Controller
{
    public function solicitar(SolicitudRegistroGraduando $request, RegistrarGraduando $registro): Response
    {
        $registro->solicitar($request->validated('email'), $request->session()->getId());

        return response()->noContent(202, ['Cache-Control' => 'no-store']);
    }

    public function confirmar(SolicitudRegistroGraduando $request, RegistrarGraduando $registro): Response
    {
        $registro->confirmar($request->validated('email'), $request->session()->getId(), $request->validated('codigo'));

        return response()->noContent(204, ['Cache-Control' => 'no-store']);
    }

    public function crear(SolicitudRegistroGraduando $request, RegistrarGraduando $registro): Response
    {
        $registro->crear($request->validated(), $request->session()->getId());

        return response()->noContent(204, ['Cache-Control' => 'no-store']);
    }
}
