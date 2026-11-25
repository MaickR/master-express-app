<?php

namespace App\Http\Responses;

use Illuminate\Http\Response;
use Laravel\Fortify\Contracts\LoginResponse;
use Laravel\Fortify\Contracts\LogoutResponse;

class SesionSinContenido implements LoginResponse, LogoutResponse
{
    public function toResponse($request): Response
    {
        return response()->noContent(204, ['Cache-Control' => 'no-store']);
    }
}
