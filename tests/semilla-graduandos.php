<?php

use App\Actions\GuardarGraduandoOperativo;
use App\Actions\ProgramarEvento;
use App\Actions\VincularGraduando;
use App\Models\Graduando;
use App\Models\Institucion;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
abort_unless($app->environment('testing') && config('database.default') === 'mysql_pruebas'
    && (int) DB::selectOne('SELECT @@port AS puerto')->puerto === 3338, 403);
$entrada = json_decode(stream_get_contents(STDIN), true);
$cuentaPrevia = User::where('email', 'qa.graduando@example.invalid')->first();
$vinculoPrevio = $cuentaPrevia?->vinculosDeGraduando()->where('estado', 'activo')->first();
if ($vinculoPrevio) {
    app(VincularGraduando::class)->anular(User::where('email', 'qa.eventos@example.invalid')->sole(), $vinculoPrevio->id, 'Se reinicia exclusivamente el vínculo sintético del recorrido Chrome.');
}

foreach (['colaborador', 'institucion', 'graduando'] as $rol) {
    if (User::where('email', 'qa.'.$rol.'@example.invalid')->exists()) {
        continue;
    }
    $usuario = User::create(['name' => 'Persona QA '.$rol, 'email' => 'qa.'.$rol.'@example.invalid', 'password' => $entrada['clave']]);
    $usuario->forceFill(['email_verified_at' => now()])->saveOrFail();
    $usuario->roles()->attach(Rol::where('codigo', $rol)->sole()->id);
    if ($rol === 'institucion') {
        $institucion = Institucion::where('nombre', 'Colegio Ficticio Beta QA')->sole();
        $sede = $institucion->sedes()->firstOrFail();
        $solicitud = DB::table('solicitudes_institucionales')->insertGetId([
            'estado' => 'aprobada', 'tipo' => 'colegio', 'razon_social' => $institucion->nombre, 'nit' => '900789123',
            'sede_nombre' => $sede->nombre, 'representante_nombre' => 'Representante QA', 'email' => $usuario->email,
            'telefono' => '3000000000', 'huella_solicitud' => str_repeat('a', 64),
        ]);
        DB::table('vinculos_institucionales')->insert(['user_id' => $usuario->id,
            'institucion_id' => $institucion->id, 'sede_id' => $sede->id, 'solicitud_id' => $solicitud, 'estado' => 'activo']);
        $admin = User::where('email', 'qa.eventos@example.invalid')->sole();
        app(ProgramarEvento::class)->ejecutar($admin, ['institucion_id' => $institucion->id, 'sede_id' => $sede->id,
            'fecha' => '2099-03-01', 'numero_ceremonias' => 1, 'operation_id' => (string) Str::uuid()]);
    }
}
if (! Graduando::where('nombre_completo', 'like', 'Paginación Chrome QA %')->exists()) {
    $admin = User::where('email', 'qa.eventos@example.invalid')->sole();
    for ($indice = 0; $indice < 26; $indice++) {
        app(GuardarGraduandoOperativo::class)->ejecutar($admin, [
            'nombre_completo' => 'Paginación Chrome QA '.$indice,
            'operation_id' => (string) Str::uuid(),
        ]);
    }
}
echo 'PASS Cuentas y programación ficticias de ME-OPS2C creadas en MySQL aislado.';
