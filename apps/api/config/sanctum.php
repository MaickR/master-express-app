<?php

return [
    'stateful' => explode(',', env(
        'SANCTUM_STATEFUL_DOMAINS',
        env('APP_ENV') === 'local' ? '127.0.0.1:5173,127.0.0.1:8000' : '',
    )),
];
