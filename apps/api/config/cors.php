<?php

$origenes = env('SPA_ALLOWED_ORIGINS', env('APP_ENV') === 'local' ? 'http://127.0.0.1:5173' : '');

return [
    'paths' => ['api/mi-sesion', 'login', 'logout', 'sanctum/csrf-cookie'],
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
