<?php

namespace Tests\MySql;

use App\Models\Rol;
use App\Models\User;
use Database\Seeders\RolSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;

class IdentidadTest extends CasoMySql
{
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
