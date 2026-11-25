<?php

use App\Http\Controllers\MiSesionController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/salud', fn (): JsonResponse => response()->json([
    'estado' => 'correcto',
    'servicio' => 'masterexpress-api',
]))->name('salud');

Route::get('/mi-sesion', MiSesionController::class)->middleware('auth:web')->name('mi-sesion');
