<?php

use App\Models\EventoDeCuenta;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

// * Solo lo invoca el proceso de QA por stdin/stdout; nunca es una ruta HTTP.
require 'vendor/autoload.php';

try {
    $app = require 'bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    $entrada = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $diagnostico = ($entrada['accion'] ?? '') === 'diagnostico-ernesto';
    $puertoEsperado = $diagnostico ? 3328 : (int) (getenv('ME_QA_MYSQL_PORT') ?: 3338);
    if (! $diagnostico && ($puertoEsperado === 3328 || getenv('ME_QA_AUTOMATIZADO') !== 'true')) { exit(2); }
    $db = DB::connection();
    if (! $app->environment('testing') || $db->getName() !== 'mysql_pruebas'
        || $db->getConfig('host') !== '127.0.0.1' || (int) $db->getConfig('port') !== $puertoEsperado
        || $db->selectOne('SELECT DATABASE() AS nombre')->nombre !== 'masterexpress_control_test'
        || config('mail.default') !== 'array') {
        exit(2);
    }
    if ($entrada['accion'] === 'diagnostico-ernesto') {
        $cuentas = User::where('email', 'admin@masterexpress.app')->get();
        echo json_encode([
            'entorno' => app()->environment(), 'conexion' => $db->getName(),
            'base' => $db->selectOne('SELECT DATABASE() AS nombre')->nombre,
            'puerto_mysql' => (int) $db->selectOne('SELECT @@port AS puerto')->puerto,
            'directorio_datos' => $db->selectOne('SELECT @@datadir AS directorio')->directorio,
            'origenes' => config('cors.allowed_origins'), 'stateful' => config('sanctum.stateful'),
            'sesiones' => config('session.driver'), 'conexion_sesiones' => config('session.connection'),
            'correo' => config('mail.default'), 'cuentas_objetivo' => $cuentas->count(),
            'cuentas' => $cuentas->map(fn (User $cuenta): array => [
                'id' => $cuenta->id, 'nombre' => $cuenta->name, 'activa' => $cuenta->activa,
                'principal' => (bool) $cuenta->principal, 'roles' => $cuenta->roles()->pluck('codigo')->all(),
                'correo_verificado' => $cuenta->email_verified_at !== null,
                'auditoria' => EventoDeCuenta::where('cuenta_id', $cuenta->id)->count(),
            ]),
        ], JSON_UNESCAPED_UNICODE);
    } elseif ($entrada['accion'] === 'entrega') {
        Artisan::call('queue:work', [
            'connection' => 'database', '--queue' => 'recuperacion', '--once' => true,
            '--stop-when-empty' => true, '--tries' => 1,
        ]);
        $mensajes = Mail::mailer()->getSymfonyTransport()->messages();
        $mensaje = $mensajes->last();
        if ($mensaje === null) {
            exit(3);
        }
        $html = $mensaje->getOriginalMessage()->getHtmlBody();
        preg_match('~href="([^"]*restablecer-contrasena#[^"]+)"~', $html, $enlace);
        // El token viaja solo al proceso de pruebas; este no lo registra.
        echo json_encode(['enlace' => html_entity_decode($enlace[1] ?? '')]);
    } elseif ($entrada['accion'] === 'resumen') {
        $principal = User::where('principal', true)->firstOrFail();
        echo json_encode(['id' => $principal->id, 'nombre' => $principal->name,
            'correo_verificado' => $principal->email_verified_at !== null,
            'cuentas' => User::count(), 'eventos' => EventoDeCuenta::count(),
            'sesiones' => $db->table('sessions')->count(), 'fallos_cola' => $db->table('failed_jobs')->count()]);
    }
} catch (Throwable) {
    fwrite(STDERR, 'No se pudo completar el soporte del ensayo aislado.');
    exit(1);
}
