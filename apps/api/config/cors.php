<?php

$origenes = env('SPA_ALLOWED_ORIGINS', env('APP_ENV') === 'local' ? 'http://127.0.0.1:5173' : '');
$rutasEventos = env('APP_ENV') === 'testing' || env('ME_EVENTOS_HABILITADOS')
    ? ['api/instituciones', 'api/eventos', 'api/eventos/*']
    : [];
$rutasEnsayo = env('APP_ENV') === 'testing' || env('ME_GRADUANDOS_HABILITADOS')
    ? ['api/registros', 'api/registros/*', 'api/ceremonias/*/registros']
    : [];

return [
    'paths' => ['api/graduandos', 'api/graduandos/*', 'api/mi-perfil', 'api/mi-perfil/*', 'api/mi-sesion', 'api/mi-institucion', 'api/mi-institucion/vinculos/*/eventos', 'api/mi-institucion/vinculos/*/eventos/*', 'api/administracion/cuentas', 'api/administracion/cuentas/*', 'api/administracion/solicitudes-institucionales', 'api/administracion/solicitudes-institucionales/*', 'api/administracion/vinculos-graduandos', 'api/administracion/vinculos-graduandos/*', 'api/registro-graduando/*', 'api/registro-institucion/*', 'login', 'logout', 'forgot-password', 'reset-password', 'sanctum/csrf-cookie', ...$rutasEventos, ...$rutasEnsayo],
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
