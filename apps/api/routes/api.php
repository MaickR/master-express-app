<?php

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/salud', fn (): JsonResponse => response()->json([
    'estado' => 'correcto',
    'servicio' => 'masterexpress-api',
]))->name('salud');
