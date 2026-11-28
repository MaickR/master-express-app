<?php

use App\Http\Controllers\CuentasInternasController;
use App\Http\Controllers\EventosController;
use App\Http\Controllers\InstitucionesController;
use App\Http\Controllers\MiInstitucionController;
use App\Http\Controllers\MiPerfilController;
use App\Http\Controllers\MiSesionController;
use App\Http\Controllers\RegistrosController;
use App\Http\Controllers\VinculosGraduandosController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/salud', fn (): JsonResponse => response()->json([
    'estado' => 'correcto',
    'servicio' => 'masterexpress-api',
]))->name('salud');

Route::get('/mi-sesion', MiSesionController::class)->middleware('auth:web')->name('mi-sesion');
Route::middleware('auth:web')->prefix('mi-institucion')->controller(MiInstitucionController::class)
    ->group(function (): void {
        Route::get('/', '__invoke')->name('mi-institucion');
        Route::get('/vinculos/{vinculo}/eventos', 'eventos')
            ->whereNumber('vinculo')->name('mi-institucion.eventos.index');
        Route::get('/vinculos/{vinculo}/eventos/{evento}', 'evento')
            ->whereNumber(['vinculo', 'evento'])->name('mi-institucion.eventos.show');
    });

Route::middleware(['auth:web', 'throttle:30,1'])->prefix('mi-perfil')->controller(MiPerfilController::class)->group(function (): void {
    Route::get('/', 'show');
    Route::post('/', 'guardar');
    Route::post('/contrasena', 'contrasena')->name('perfil.contrasena');
});

Route::middleware(['auth:web', 'throttle:30,1'])->prefix('administracion/cuentas')->group(function (): void {
    Route::post('/', [CuentasInternasController::class, 'store']);
    Route::get('/auditoria', [CuentasInternasController::class, 'auditoria']);
    Route::get('/', [CuentasInternasController::class, 'index'])->name('cuentas.index');
    Route::post('/{cuenta}', [CuentasInternasController::class, 'actualizar'])->whereNumber('cuenta')->name('cuentas.actualizar');
});

Route::middleware(['auth:web', 'throttle:vinculacion-graduandos'])
    ->prefix('administracion/vinculos-graduandos')
    ->name('vinculos-graduandos.')
    ->controller(VinculosGraduandosController::class)
    ->group(function (): void {
        Route::get('/graduandos', 'graduandos')->name('graduandos');
        Route::get('/cuentas', 'cuentas')->name('cuentas');
        Route::post('/', 'store')->name('store');
        Route::post('/{vinculo}/anulacion', 'anular')->whereNumber('vinculo')->name('anular');
        Route::post('/{vinculo}/correccion', 'corregir')->whereNumber('vinculo')->name('corregir');
    });

Route::get('/instituciones', [InstitucionesController::class, 'index'])->middleware('auth:web')->name('instituciones.index');

Route::middleware('auth:web')->group(function (): void {
    Route::get('/registros', [RegistrosController::class, 'index'])->name('registros.index');
    Route::get('/registros/{registro}', [RegistrosController::class, 'show'])
        ->whereNumber('registro')->name('registros.show');
    Route::post('/ceremonias/{ceremonia}/registros', [RegistrosController::class, 'store'])
        ->where('ceremonia', '[1-9][0-9]*')->name('ceremonias.registros.store');
});

Route::middleware('auth:web')->prefix('eventos')->group(function (): void {
    Route::get('/', [EventosController::class, 'index'])->name('eventos.index');
    Route::post('/', [EventosController::class, 'store'])->name('eventos.store');
    Route::get('/{evento}', [EventosController::class, 'show'])->whereNumber('evento')->name('eventos.show');
    Route::post('/{evento}', [EventosController::class, 'update'])->whereNumber('evento')->name('eventos.update');
    Route::post('/{evento}/cancelacion', [EventosController::class, 'cancelar'])->whereNumber('evento')->name('eventos.cancelar');
    Route::get('/{evento}/ceremonias', [EventosController::class, 'ceremonias'])
        ->whereNumber('evento')->name('eventos.ceremonias.index');
    Route::get('/{evento}/ceremonias/{ceremonia}', [EventosController::class, 'ceremonia'])
        ->whereNumber(['evento', 'ceremonia'])->name('eventos.ceremonias.show');
});
