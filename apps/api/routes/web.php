<?php

use App\Http\Controllers\RecuperacionController;
use App\Http\Controllers\RegistroGraduandoController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Http\Controllers\AuthenticatedSessionController;

Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware('throttle:login')->name('login');

Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth:web')->name('logout');

Route::post('/forgot-password', [RecuperacionController::class, 'solicitar'])
    ->middleware('throttle:solicitar-recuperacion')->name('password.email');

Route::post('/reset-password', [RecuperacionController::class, 'restablecer'])
    ->middleware('throttle:restablecer-contrasena')->name('password.update');

Route::prefix('api/registro-graduando')->name('registro-graduando.')->controller(RegistroGraduandoController::class)
    ->group(function (): void {
        Route::post('/codigo', 'solicitar')->middleware('throttle:registro-graduando-solicitar')->name('solicitar');
        Route::post('/confirmacion', 'confirmar')->middleware('throttle:registro-graduando-verificar')->name('confirmar');
        Route::post('/cuenta', 'crear')->middleware('throttle:registro-graduando-verificar')->name('crear');
    });
