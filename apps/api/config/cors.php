<?php

$origenes = env('SPA_ALLOWED_ORIGINS', env('APP_ENV') === 'local' ? 'http://127.0.0.1:5173' : '');
$rutasEnsayo = env('APP_ENV') === 'testing'
    ? ['api/instituciones', 'api/eventos', 'api/eventos/*', 'api/registros', 'api/registros/*', 'api/ceremonias/*/registros']
    : [];

return [
    'paths' => ['api/mi-sesion', 'api/administracion/cuentas', 'api/administracion/cuentas/*', 'api/registro-graduando/*', 'login', 'logout', 'forgot-password', 'reset-password', 'sanctum/csrf-cookie', ...$rutasEnsayo],
    'allowed_methods' => ['GET', 'POST'],
    'allowed_origins' => array_values(array_filter(
        array_map('trim', explode(',', (string) $origenes)),
        fn (string $origen): bool => preg_match('~\Ahttps?://[a-zA-Z0-9.-]+(?::[0-9]+)?\z~', $origen) === 1,
    )),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Content-Type', 'X-XSRF-TOKEN'],
    'exposed_headers' => ['Retry-After'],
    'max_age' => 0,
    'supports_credentials' => true,
];
