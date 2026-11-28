<?php

namespace Tests\MySql;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use PDOException;
use Tests\TestCase;

abstract class CasoMySql extends TestCase
{
    use DatabaseTransactions {
        beginDatabaseTransaction as private iniciarTransaccion;
    }

    protected array $connectionsToTransact = ['mysql_pruebas'];

    protected array $tablas = ['users', 'roles', 'rol_user'];

    public function beginDatabaseTransaction(): void
    {
        $this->assertTrue(app()->environment('testing'));
        $this->assertNotSame(3328, (int) config('database.connections.mysql_pruebas.port'),
            'MySQL 3328 está reservado para aceptación humana. Usa una instancia automatizada aislada.');
        $this->assertNotSame('true', getenv('ME_QA_ACEPTACION_HUMANA'), 'No se ejecuta PHPUnit sobre aceptación humana.');
        $this->assertNotEmpty(config('database.connections.mysql_pruebas.username'), 'Configure la cuenta local de pruebas.');
        $conexion = DB::connection('mysql_pruebas');

        try {
            $identidad = $conexion->selectOne('SELECT DATABASE() AS nombre, @@foreign_key_checks AS claves_activas');
        } catch (PDOException) {
            $this->fail('No se pudo abrir la base MySQL local de pruebas con la cuenta configurada.');
        }

        $this->assertSame('masterexpress_control_test', $identidad->nombre);
        $this->assertSame(1, (int) $identidad->claves_activas);
        $this->assertFalse($conexion->table('information_schema.SCHEMATA')
            ->where('SCHEMA_NAME', 'masterexpress_control_dev')->exists(), 'La cuenta de pruebas tiene visibilidad sobre desarrollo.');
        $motores = $conexion->table('information_schema.TABLES')
            ->where('TABLE_SCHEMA', $identidad->nombre)
            ->whereIn('TABLE_NAME', $this->tablas)
            ->pluck('ENGINE')->all();
        $this->assertSame(array_fill(0, count($this->tablas), 'InnoDB'), $motores, 'Las tablas deben existir y ser transaccionales.');

        DB::setDefaultConnection('mysql_pruebas');
        $this->iniciarTransaccion();
    }
}
