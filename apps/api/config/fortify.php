<?php

return [
    'guard' => 'web',
    'username' => 'email',
    'lowercase_usernames' => true,
    'middleware' => ['web'],
    'views' => false,
    'limiters' => ['login' => 'login'],
    'features' => [],
];
