<?php

use App\Http\Controllers\CuentasInternasController;
use App\Http\Controllers\EventosController;
use App\Http\Controllers\MiSesionController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/salud', fn (): JsonResponse => response()->json([
    'estado' => 'correcto',
    'servicio' => 'masterexpress-api',
]))->name('salud');

Route::get('/mi-sesion', MiSesionController::class)->middleware('auth:web')->name('mi-sesion');

Route::middleware('auth:web')->prefix('administracion/cuentas')->group(function (): void {
    Route::get('/', [CuentasInternasController::class, 'index'])->name('cuentas.index');
    Route::post('/{cuenta}', [CuentasInternasController::class, 'actualizar'])->whereNumber('cuenta')->name('cuentas.actualizar');
});

Route::middleware('auth:web')->prefix('eventos')->group(function (): void {
    Route::get('/', [EventosController::class, 'index'])->name('eventos.index');
    Route::post('/', [EventosController::class, 'store'])->name('eventos.store');
    Route::get('/{evento}', [EventosController::class, 'show'])->whereNumber('evento')->name('eventos.show');
    Route::get('/{evento}/ceremonias', [EventosController::class, 'ceremonias'])
        ->whereNumber('evento')->name('eventos.ceremonias.index');
    Route::get('/{evento}/ceremonias/{ceremonia}', [EventosController::class, 'ceremonia'])
        ->whereNumber(['evento', 'ceremonia'])->name('eventos.ceremonias.show');
});
