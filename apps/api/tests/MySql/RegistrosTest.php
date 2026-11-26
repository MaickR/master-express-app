<?php

namespace Tests\MySql;

use App\Actions\ProgramarEvento;
use App\Models\Ceremonia;
use App\Models\Graduando;
use App\Models\Institucion;
use App\Models\Registro;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RegistrosTest extends CasoMySql
{
    protected array $tablas = ['users', 'roles', 'rol_user', 'instituciones', 'eventos', 'ceremonias', 'graduandos', 'registros'];

    private User $administrador;

    protected function setUp(): void
    {
        parent::setUp();

        $this->administrador = $this->usuario('administrador');
    }

    public function test_alta_consultas_filtradas_y_homonimos_por_id_interno(): void
    {
        $actor = $this->usuario('colaborador');
        $ceremonia = $this->ceremonia();
        $otra = $this->ceremonia();
        $entrada = $this->entrada($ceremonia);
        $homonimo = Graduando::query()->create(['nombre_completo' => 'Graduando ficticio']);
        $this->actingAs($actor, 'web');

        $respuesta = $this->postJson($this->ruta($ceremonia), $entrada)->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.graduando.id', $entrada['graduando_id'])
            ->assertJsonPath('data.graduando.nombre_completo', $homonimo->nombre_completo)
            ->assertJsonPath('data.programa_academico', 'Programa ficticio')
            ->assertJsonPath('data.evento_id', $ceremonia->evento_id)
            ->assertJsonPath('data.ceremonia_id', $ceremonia->id)
            ->assertJsonMissingPath('data.actor_id')
            ->assertJsonMissingPath('data.operation_id')
            ->assertJsonMissingPath('data.huella_solicitud');
        $id = $respuesta->json('data.id');
        $this->assertDatabaseHas('registros', ['id' => $id, 'actor_id' => $actor->id]);

        $this->postJson($this->ruta($ceremonia), $this->entrada($ceremonia, $homonimo))->assertCreated();
        $this->postJson($this->ruta($otra), $this->entrada($otra, $homonimo))->assertCreated();
        $this->getJson('/api/registros/'.$id)->assertOk()->assertExactJson($respuesta->json());
        $this->getJson('/api/registros?ceremonia_id='.$ceremonia->id)->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/registros?evento_id='.$otra->evento_id)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/registros?ceremonia_id='.$ceremonia->id.'&evento_id='.$otra->evento_id)
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/registros?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');
    }

    public function test_idempotencia_conflictos_y_unicidad_independiente_del_actor(): void
    {
        $actor = $this->usuario('colaborador');
        $ceremonia = $this->ceremonia();
        $otra = $this->ceremonia();
        $entrada = $this->entrada($ceremonia);
        $ruta = $this->ruta($ceremonia);
        $this->actingAs($actor, 'web');

        $datos = $this->postJson($ruta, $entrada)->assertCreated()->json();
        $reintento = array_replace($entrada, [
            'operation_id' => strtoupper($entrada['operation_id']),
            'graduando_id' => (string) $entrada['graduando_id'],
            'programa_academico' => ' Programa ficticio ',
        ]);
        $this->postJson($ruta, $reintento)->assertCreated()->assertExactJson($datos);
        $this->postJson($ruta, array_replace($entrada, ['programa_academico' => 'Otro programa']))->assertConflict();
        $this->postJson($ruta, array_replace($entrada, ['evento_id' => $otra->evento_id]))->assertConflict();
        $this->postJson($this->ruta($otra), array_replace($entrada, ['evento_id' => $otra->evento_id]))->assertConflict();
        $this->postJson($ruta, array_replace($entrada, ['operation_id' => (string) Str::uuid()]))->assertConflict();

        $this->actingAs($this->usuario('colaborador'), 'web');
        $this->postJson($ruta, $entrada)->assertConflict()->assertJsonMissingPath('data.id');
        $this->postJson($this->ruta($otra), array_replace($entrada, ['evento_id' => $otra->evento_id]))->assertCreated();

        $original = Registro::query()->findOrFail($datos['data']['id']);
        $this->assertDatabaseCount('registros', 2);
        $copia = Arr::except($original->getRawOriginal(), 'id');
        $this->assertThrows(fn () => DB::table('registros')->insert(
            array_replace($copia, ['operation_id' => (string) Str::uuid()]),
        ), UniqueConstraintViolationException::class);
        $this->assertThrows(fn () => DB::table('registros')->insert(
            array_replace($copia, ['graduando_id' => $this->entrada($ceremonia)['graduando_id']]),
        ), UniqueConstraintViolationException::class);
    }

    public function test_rechaza_referencias_cruzadas_y_campos_de_atribucion_o_pago(): void
    {
        $this->actingAs($this->usuario('colaborador'), 'web');
        $ceremonia = $this->ceremonia();
        $entrada = $this->entrada($ceremonia);
        $ruta = $this->ruta($ceremonia);
        $otra = $this->ceremonia();
        $this->postJson('/api/ceremonias/'.PHP_INT_MAX.'/registros', $entrada)->assertNotFound();
        $this->postJson($ruta, array_replace($entrada, ['evento_id' => $otra->evento_id]))->assertNotFound();
        $this->postJson($ruta, array_replace($entrada, ['graduando_id' => PHP_INT_MAX]))
            ->assertUnprocessable()->assertJsonValidationErrors('registro.graduando_id');

        foreach (['actor_id', 'colaborador_id', 'estado_pago', 'paquete', 'nombre_completo'] as $campo) {
            $this->postJson($ruta, $entrada + [$campo => 'ficticio'])
                ->assertUnprocessable()->assertJsonValidationErrors('registro');
        }

        $this->postJson($ruta, ['operation_id' => 'invalido', 'evento_id' => 0, 'graduando_id' => 'nombre'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['registro.operation_id', 'registro.evento_id', 'registro.graduando_id']);
        $this->assertDatabaseCount('registros', 0);
    }

    public function test_consultas_y_altas_respetan_roles_y_ambito_del_ensayo(): void
    {
        $ceremonia = $this->ceremonia();
        $entrada = $this->entrada($ceremonia);
        $ruta = $this->ruta($ceremonia);

        $this->getJson('/api/registros')->assertUnauthorized();
        $this->postJson($ruta, $entrada)->assertUnauthorized();
        $this->actingAs($this->usuario('colaborador'), 'web');
        $id = $this->postJson($ruta, $entrada)->assertCreated()->json('data.id');

        $this->actingAs($this->usuario('colaborador', 'institucion'), 'web');
        $this->getJson('/api/registros?ceremonia_id='.$ceremonia->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/registros/'.$id)->assertNotFound();

        $this->actingAs($this->usuario('institucion'), 'web');
        $this->getJson('/api/registros/'.$id)->assertForbidden();
        $this->postJson($ruta, $entrada)->assertForbidden();

        $this->actingAs($this->administrador, 'web');
        $this->getJson('/api/registros')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/registros/'.$id)->assertOk();
        $this->postJson($ruta, $entrada)->assertForbidden();

        $this->app->instance('env', 'production');
        $this->getJson('/api/registros/'.$id)->assertForbidden();
        $this->actingAs($this->usuario('colaborador'), 'web');
        $this->postJson($ruta, $entrada)->assertForbidden();
    }

    public function test_transaccion_revierte_fallo_despues_de_insertar_y_claves_foraneas_protegen_el_registro(): void
    {
        $actor = $this->usuario('colaborador');
        $ceremonia = $this->ceremonia();
        $entrada = $this->entrada($ceremonia);
        $ruta = $this->ruta($ceremonia);
        $this->actingAs($actor, 'web');
        $fallar = true;

        Registro::created(function () use (&$fallar): void {
            if ($fallar) {
                throw new \RuntimeException('Fallo simulado después de insertar.');
            }
        });

        $this->postJson($ruta, $entrada)->assertInternalServerError()->assertJsonMissingPath('trace');
        $this->assertDatabaseCount('registros', 0);

        $fallar = false;
        $this->postJson($ruta, $entrada)->assertCreated();
        $registro = Registro::query()->sole();
        foreach (['ceremonia', 'graduando', 'actor'] as $relacion) {
            $this->assertThrows(fn () => $registro->{$relacion}->delete(), QueryException::class);
        }

        $copia = Arr::except($registro->getRawOriginal(), 'id');
        foreach (['ceremonia_id', 'graduando_id', 'actor_id'] as $campo) {
            $this->assertThrows(fn () => DB::table('registros')->insert(
                array_replace($copia, ['operation_id' => (string) Str::uuid(), $campo => PHP_INT_MAX]),
            ), QueryException::class);
        }
    }

    private function usuario(string ...$roles): User
    {
        $actor = User::factory()->create(['name' => 'Persona ficticia', 'email' => Str::uuid().'@example.invalid']);
        $actor->roles()->attach(Rol::query()->whereIn('codigo', $roles)->pluck('id'));

        return $actor->refresh();
    }

    private function ceremonia(): Ceremonia
    {
        $institucion = Institucion::query()->create(['nombre' => 'Institución ficticia', 'tipo' => 'universidad']);

        return app(ProgramarEvento::class)->ejecutar($this->administrador, [
            'institucion_id' => $institucion->id,
            'fecha' => '2099-02-25',
            'numero_ceremonias' => 1,
            'operation_id' => (string) Str::uuid(),
        ])->ceremonias()->sole();
    }

    private function entrada(Ceremonia $ceremonia, ?Graduando $graduando = null): array
    {
        $graduando ??= Graduando::query()->create(['nombre_completo' => 'Graduando ficticio']);

        return [
            'operation_id' => (string) Str::uuid(),
            'evento_id' => $ceremonia->evento_id,
            'graduando_id' => $graduando->id,
            'programa_academico' => 'Programa ficticio',
        ];
    }

    private function ruta(Ceremonia $ceremonia): string
    {
        return '/api/ceremonias/'.$ceremonia->id.'/registros';
    }
}
