<?php

use App\Http\Middleware\AutenticarSesionSpa;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;

return [
    'middleware' => [
        'authenticate_session' => AutenticarSesionSpa::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => PreventRequestForgery::class,
    ],
    'stateful' => explode(',', env(
        'SANCTUM_STATEFUL_DOMAINS',
        env('APP_ENV') === 'local' ? '127.0.0.1:5173,127.0.0.1:8000' : '',
    )),
];
