<?php

namespace Tests\MySql;

use App\Models\Rol;
use App\Models\User;
use Database\Seeders\RolSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use PDOException;
use Tests\TestCase;

class IdentidadTest extends TestCase
{
    use DatabaseTransactions {
        beginDatabaseTransaction as private iniciarTransaccion;
    }

    protected array $connectionsToTransact = ['mysql_pruebas'];

    public function beginDatabaseTransaction(): void
    {
        $this->assertTrue(app()->environment('testing'));
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
            ->whereIn('TABLE_NAME', ['users', 'roles', 'rol_user'])
            ->pluck('ENGINE')->all();
        $this->assertSame(['InnoDB', 'InnoDB', 'InnoDB'], $motores, 'Las tres tablas deben existir y ser transaccionales.');

        DB::setDefaultConnection('mysql_pruebas');
        $this->iniciarTransaccion();
    }

    public function test_catalogo_completo_idempotente_y_codigo_unico(): void
    {
        $codigos = ['administrador', 'colaborador', 'finanzas', 'graduando', 'institucion', 'inventario', 'vendedor'];
        $this->seed(RolSeeder::class);
        $antes = Rol::query()->orderBy('codigo')->get()->toArray();
        $this->seed(RolSeeder::class);

        $this->assertSame($codigos, array_column($antes, 'codigo'));
        $this->assertSame($antes, Rol::query()->orderBy('codigo')->get()->toArray());
        $this->assertThrows(
            fn () => Rol::query()->create(['codigo' => 'administrador']),
            UniqueConstraintViolationException::class,
        );
    }

    public function test_usuario_ficticio_persiste_y_tiene_varios_roles_sin_duplicados(): void
    {
        $this->seed(RolSeeder::class);
        $usuario = User::factory()->unverified()->create(['email' => 'identidad@example.invalid']);
        $admin = Rol::query()->where('codigo', 'administrador')->firstOrFail();
        $inventario = Rol::query()->where('codigo', 'inventario')->firstOrFail();

        $usuario->roles()->attach([$admin->id, $inventario->id]);
        $consultado = User::query()->where('email', 'identidad@example.invalid')->firstOrFail();

        $this->assertTrue($usuario->is($consultado));
        $this->assertSame(['administrador', 'inventario'], $consultado->roles()->orderBy('codigo')->pluck('codigo')->all());
        $this->assertTrue($admin->usuarios()->firstOrFail()->is($usuario));
        $this->assertNotNull($consultado->roles->first()->pivot->created_at);
        $this->assertArrayNotHasKey('password', $consultado->toArray());
        $this->assertThrows(fn () => $usuario->roles()->attach($admin), UniqueConstraintViolationException::class);
        $this->assertThrows(fn () => User::factory()->create(['email' => $usuario->email]), UniqueConstraintViolationException::class);
    }

    public function test_claves_foraneas_y_reglas_de_borrado_del_vinculo(): void
    {
        $this->seed(RolSeeder::class);
        $usuario = User::factory()->create();
        $rol = Rol::query()->where('codigo', 'colaborador')->firstOrFail();

        $this->assertThrows(fn () => $usuario->roles()->attach(0), QueryException::class);
        $this->assertThrows(fn () => $rol->usuarios()->attach(0), QueryException::class);
        $usuario->roles()->attach($rol);
        $this->assertThrows(fn () => $rol->delete(), QueryException::class);

        $usuario->delete();
        $this->assertDatabaseMissing('rol_user', ['user_id' => $usuario->id, 'rol_id' => $rol->id]);
        $this->assertModelExists($rol);
    }
}
