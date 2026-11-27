<?php

use App\Http\Controllers\DecisionInstitucionalController;
use App\Http\Controllers\RecuperacionController;
use App\Http\Controllers\RegistroGraduandoController;
use App\Http\Controllers\RegistroInstitucionController;
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

Route::prefix('api/registro-institucion')->name('registro-institucion.')->controller(RegistroInstitucionController::class)
    ->group(function (): void {
        Route::post('/codigo', 'solicitar')->middleware('throttle:registro-institucion-solicitar')->name('solicitar');
        Route::post('/confirmacion', 'confirmar')->middleware('throttle:registro-institucion-verificar')->name('confirmar');
        Route::post('/solicitud', 'crear')->middleware('throttle:registro-institucion-verificar')->name('crear');
        Route::post('/representacion', 'representar')->middleware(['auth:web', 'throttle:registro-institucion-verificar'])->name('representar');
        Route::post('/activacion', 'activar')->middleware('throttle:activar-institucion')->name('activar');
    });

Route::middleware(['auth:web', 'throttle:decision-institucional'])
    ->prefix('api/administracion/solicitudes-institucionales')
    ->name('solicitudes-institucionales.')
    ->controller(DecisionInstitucionalController::class)
    ->group(function (): void {
        Route::get('/', 'index')->name('index');
        Route::get('/decisiones', 'decisiones')->name('decisiones');
        Route::get('/{solicitud}', 'show')->whereNumber('solicitud')->name('show');
        Route::post('/{solicitud}/aprobacion', 'aprobar')->whereNumber('solicitud')->name('aprobar');
        Route::post('/{solicitud}/rechazo', 'rechazar')->whereNumber('solicitud')->name('rechazar');
        Route::post('/{solicitud}/notificacion', 'notificar')->whereNumber('solicitud')->name('notificar');
    });
