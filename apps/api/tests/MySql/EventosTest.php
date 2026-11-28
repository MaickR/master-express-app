<?php

namespace Tests\MySql;

use App\Console\Commands\EnsayoEventos;
use App\Models\Ceremonia;
use App\Models\Evento;
use App\Models\Institucion;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EventosTest extends CasoMySql
{
    private const string RUTA = '/api/eventos';

    protected array $tablas = ['users', 'roles', 'rol_user', 'instituciones', 'sedes', 'eventos', 'ceremonias'];

    public function test_dia_operativo_de_bogota_y_reintento_despues_de_medianoche(): void
    {
        $this->autenticar('administrador');
        $this->travelTo(Carbon::parse('2030-05-01 04:59:59', 'UTC'), function (): void {
            $institucion = $this->institucion();
            $entrada = $this->entrada($institucion, ['fecha' => '2030-04-30']);
            $id = $this->postJson(self::RUTA, $entrada)->assertCreated()->assertJsonPath('data.estado', 'en_ejecucion')->json('data.id');
            $this->postJson(self::RUTA, array_replace($entrada, ['fecha' => '2030-04-29', 'operation_id' => (string) Str::uuid()]))
                ->assertUnprocessable()->assertJsonValidationErrors('evento.fecha');
            $this->postJson(self::RUTA, array_replace($entrada, ['fecha' => '2030-04-31', 'operation_id' => (string) Str::uuid()]))
                ->assertUnprocessable()->assertJsonValidationErrors('evento.fecha');
            $this->postJson(self::RUTA, array_replace($entrada, ['fecha' => '2030-05-01', 'operation_id' => (string) Str::uuid()]))
                ->assertCreated()->assertJsonPath('data.estado', 'proximo');
            $this->travel(1)->seconds();
            $this->getJson(self::RUTA.'?vista=historial')->assertOk()
                ->assertJsonPath('fecha_operativa', '2030-05-01')->assertJsonPath('data.0.estado', 'finalizado');
            $this->postJson(self::RUTA, $entrada)->assertCreated()->assertJsonPath('data.id', $id);
            $this->postJson(self::RUTA.'/'.$id, ['revision' => 1, 'lugar' => 'Corrección histórica'])
                ->assertConflict();
            $this->postJson(self::RUTA.'/'.$id.'/cancelacion')->assertConflict();
            $this->assertDatabaseHas('eventos', ['id' => $id, 'fecha' => '2030-04-30', 'lugar' => null]);
        });
    }

    public function test_edita_atomicamente_consulta_y_cancela_con_auditoria(): void
    {
        $actor = $this->autenticar('administrador');
        $entrada = $this->entrada($this->institucion());
        $evento = $this->postJson(self::RUTA, $entrada)->assertCreated()->json('data');
        $otro = $this->postJson(self::RUTA, array_replace($entrada, ['operation_id' => (string) Str::uuid()]))->assertCreated()->json('data');
        $ruta = self::RUTA.'/'.$evento['id'];
        $ceremonia = ['id' => $evento['ceremonias'][0]['id'], 'nombre' => 'Ceremonia de diseño', 'hora' => '08:30'];
        $cambios = [
            'revision' => 1, 'lugar' => 'Auditorio QA', 'responsable' => 'Equipo QA',
            'graduandos_previstos' => 0, 'observaciones' => 'Ingresar por recepción.',
            'ceremonias' => [$ceremonia],
        ];
        $this->postJson($ruta, array_replace($cambios, ['ceremonias' => [$ceremonia, array_replace($ceremonia, ['id' => $otro['ceremonias'][0]['id']])]]))
            ->assertUnprocessable()->assertJsonValidationErrors('evento.ceremonias.1.id');
        $this->assertDatabaseHas('ceremonias', ['id' => $ceremonia['id'], 'nombre' => 'Ceremonia 1', 'hora' => null]);
        $this->postJson($ruta, $cambios)->assertOk()->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.graduandos_previstos', 0)->assertJsonPath('data.ceremonias.0.nombre', $ceremonia['nombre']);
        $this->getJson($ruta)->assertOk()->assertJsonPath('data.ceremonias.0.hora', '08:30:00');
        $this->postJson($ruta, $cambios)->assertConflict();
        $this->getJson(self::RUTA.'?vista=activa&buscar=dise%C3%B1o&estado=proximo&desde=2099-01-01&hasta=2099-03-01')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $evento['id']);
        $this->getJson(self::RUTA.'?vista=activa&buscar='.$evento['id'])->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson(self::RUTA.'?desde=2099-04-01&hasta=2099-03-01')->assertUnprocessable();

        $cancelado = $this->postJson($ruta.'/cancelacion')->assertOk()->assertJsonPath('data.estado', 'cancelado')
            ->assertJsonCount(3, 'data.ceremonias')->json('data.cancelado_en');
        $this->postJson($ruta.'/cancelacion')->assertOk()->assertJsonPath('data.cancelado_en', $cancelado);
        $this->postJson($ruta, array_replace($cambios, ['revision' => 2]))->assertConflict();
        $this->assertDatabaseHas('eventos', ['id' => $evento['id'], 'cancelado_por' => $actor->id, 'lugar' => 'Auditorio QA']);
        $this->getJson(self::RUTA.'?vista=activa&buscar=Auditorio')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::RUTA.'?vista=historial&estado=cancelado')->assertOk()->assertJsonPath('data.0.id', $evento['id']);

        $this->autenticar('colaborador');
        $this->postJson($ruta, $cambios)->assertForbidden();
        $this->postJson(self::RUTA.'/'.PHP_INT_MAX.'/cancelacion')->assertForbidden();
    }

    public function test_activacion_explicita_del_contrato_fuera_del_ensayo(): void
    {
        $this->autenticar('administrador');
        $this->app->instance('env', 'production');
        $this->getJson(self::RUTA)->assertForbidden();
        config(['eventos.habilitados' => true]);
        $this->postJson(self::RUTA, $this->entrada($this->institucion()))->assertCreated();
        $this->autenticar('colaborador');
        $this->getJson(self::RUTA)->assertForbidden();
    }

    public function test_alta_y_consultas_con_identidad_institucional_estable_y_ceremonias_ordenadas(): void
    {
        $actor = $this->autenticar('administrador');
        $institucion = $this->institucion();
        $homonima = $this->institucion();
        $entrada = $this->entrada($institucion);
        $respuesta = $this->postJson(self::RUTA, $entrada)->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.institucion.id', $institucion->id)
            ->assertJsonPath('data.sede.id', $entrada['sede_id'])
            ->assertJsonPath('data.fecha', $entrada['fecha'])
            ->assertJsonPath('data.numero_ceremonias', 3)
            ->assertJsonPath('data.ceremonias.2.nombre', 'Ceremonia 3')
            ->assertJsonPath('data.ceremonias.2.hora', null)
            ->assertJsonPath('data.ceremonias.2.orden', 3)
            ->assertJsonMissingPath('data.actor_id')
            ->assertJsonMissingPath('data.operation_id')
            ->assertJsonMissingPath('data.huella_solicitud');
        $id = $respuesta->json('data.id');
        $rutaEvento = self::RUTA.'/'.$id;

        $this->assertDatabaseHas('eventos', ['id' => $id, 'actor_id' => $actor->id, 'institucion_id' => $institucion->id, 'sede_id' => $entrada['sede_id']]);
        $this->getJson($rutaEvento)->assertOk()->assertExactJson($respuesta->json());
        $this->getJson($rutaEvento.'/ceremonias')->assertOk()->assertJsonCount(3, 'data');
        $this->getJson($rutaEvento.'/ceremonias/'.$respuesta->json('data.ceremonias.0.id'))
            ->assertOk()->assertJsonPath('data.evento_id', $id);
        $this->getJson(self::RUTA.'?institucion_id='.$homonima->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::RUTA.'?institucion_id='.$institucion->id)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.numero_ceremonias', 3)->assertJsonMissingPath('data.0.ceremonias');
    }

    public function test_listado_paginas_con_orden_estable_por_fecha_e_id(): void
    {
        $this->autenticar('administrador');
        $institucion = $this->institucion();
        $entrada = $this->entrada($institucion, ['numero_ceremonias' => 1]);
        $primero = $this->postJson(self::RUTA, $entrada)->assertCreated()->json('data.id');
        for ($indice = 0; $indice < 25; $indice++) {
            $ultimo = $this->postJson(self::RUTA, array_replace($entrada, ['operation_id' => (string) Str::uuid()]))
                ->assertCreated()->json('data.id');
        }

        $ruta = self::RUTA.'?institucion_id='.$institucion->id;
        $pagina = $this->getJson($ruta)->assertOk()->assertJsonCount(25, 'data')->assertJsonPath('data.0.id', $ultimo);
        $this->getJson($pagina->json('links.next'))->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $primero)->assertJsonPath('links.next', null);
        $this->getJson(self::RUTA.'?page=-1')->assertUnprocessable()->assertJsonValidationErrors('page');
    }

    public function test_reintento_normalizado_resultado_original_y_conflicto_por_objetivo_o_contenido(): void
    {
        $actor = $this->autenticar('administrador');
        $institucion = $this->institucion();
        $entrada = $this->entrada($institucion);
        $datos = $this->postJson(self::RUTA, $entrada)->assertCreated()->json();

        $this->postJson(self::RUTA, array_replace($entrada, [
            'institucion_id' => (string) $institucion->id,
            'sede_id' => (string) $entrada['sede_id'],
            'operation_id' => strtoupper($entrada['operation_id']),
            'numero_ceremonias' => '3',
            'lugar' => '   ',
        ]))->assertCreated()->assertExactJson($datos);
        $this->postJson(self::RUTA, array_replace($entrada, ['numero_ceremonias' => 4]))->assertConflict();
        $this->postJson(self::RUTA, array_replace($entrada, ['institucion_id' => $this->institucion()->id]))->assertConflict();

        $otraSede = $institucion->sedes()->create(['nombre' => 'Sede alterna']);
        $this->postJson(self::RUTA, array_replace($entrada, ['sede_id' => $otraSede->id]))->assertConflict();

        $evento = Evento::query()->findOrFail($datos['data']['id']);
        $this->assertSame(3, $evento->ceremonias()->count());
        $this->assertSame(1, Evento::query()->where('actor_id', $actor->id)->count());
        $this->assertThrows(fn () => DB::table('eventos')->insert(
            Arr::except($evento->getRawOriginal(), 'id'),
        ), UniqueConstraintViolationException::class);

        $this->autenticar('administrador');
        $this->assertNotSame($evento->id, $this->postJson(self::RUTA, $entrada)->assertCreated()->json('data.id'));
    }

    public function test_fallo_de_segunda_ceremonia_revierte_el_alta_y_permite_reintentar(): void
    {
        $actor = $this->autenticar('administrador');
        $entrada = $this->entrada($this->institucion());
        $fallar = true;
        Ceremonia::creating(function (Ceremonia $ceremonia) use (&$fallar): ?bool {
            return $fallar && $ceremonia->orden === 2 ? false : null;
        });
        $totalCeremonias = Ceremonia::query()->count();

        $this->postJson(self::RUTA, $entrada)->assertInternalServerError()
            ->assertJsonMissingPath('exception')->assertJsonMissingPath('trace');
        $this->assertDatabaseMissing('eventos', ['actor_id' => $actor->id, 'operation_id' => $entrada['operation_id']]);
        $this->assertDatabaseCount('ceremonias', $totalCeremonias);

        $fallar = false;
        $this->postJson(self::RUTA, $entrada)->assertCreated()->assertJsonCount(3, 'data.ceremonias');
    }

    public function test_rechaza_referencias_invalidas_y_la_base_impide_huerfanos(): void
    {
        $actor = $this->autenticar('administrador');
        $institucion = $this->institucion();
        $entrada = $this->entrada($institucion);

        $this->postJson(self::RUTA, array_replace($entrada, ['institucion_id' => PHP_INT_MAX]))
            ->assertUnprocessable()->assertJsonValidationErrors('evento.institucion_id');
        $sedeAjena = $this->institucion()->sedes()->create(['nombre' => 'Sede ajena']);
        $this->postJson(self::RUTA, array_replace($entrada, ['sede_id' => $sedeAjena->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('evento.sede_id');
        $this->postJson(self::RUTA, Arr::except($entrada, 'sede_id'))
            ->assertUnprocessable()->assertJsonValidationErrors('evento.sede_id');
        $this->postJson(self::RUTA, $entrada + ['actor_id' => $actor->id, 'activo' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('evento');
        $this->postJson(self::RUTA, $entrada + ['ceremonias' => [['evento_id' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('evento');
        $this->postJson(self::RUTA, array_replace($entrada, ['operation_id' => 'invalido', 'fecha' => '2027-02-30', 'numero_ceremonias' => 0]))
            ->assertUnprocessable()->assertJsonValidationErrors(['evento.operation_id', 'evento.fecha', 'evento.numero_ceremonias']);
        $this->assertDatabaseMissing('eventos', ['actor_id' => $actor->id]);

        $evento = $this->postJson(self::RUTA, $entrada)->assertCreated()->json('data');
        $otro = $this->postJson(self::RUTA, array_replace($entrada, ['operation_id' => (string) Str::uuid()]))
            ->assertCreated()->json('data');
        $this->getJson(self::RUTA.'/'.$evento['id'].'/ceremonias/'.$otro['ceremonias'][0]['id'])->assertNotFound();
        $this->getJson(self::RUTA.'/'.PHP_INT_MAX)->assertNotFound();

        $this->assertThrows(fn () => (new Ceremonia(['nombre' => 'Huérfana', 'orden' => 1]))
            ->forceFill(['evento_id' => PHP_INT_MAX])->save(), QueryException::class);
        $this->assertThrows(fn () => Evento::query()->findOrFail($evento['id'])->delete(), QueryException::class);
        $this->assertThrows(fn () => $institucion->delete(), QueryException::class);
    }

    public function test_sin_sesion_sin_permiso_y_fuera_de_qa_se_deniega_sin_filtrar_referencias(): void
    {
        $entrada = $this->entrada($this->institucion());
        $this->getJson(self::RUTA)->assertUnauthorized();
        $this->postJson(self::RUTA, $entrada)->assertUnauthorized();

        foreach (['colaborador', 'graduando', 'institucion'] as $rol) {
            $this->autenticar($rol);
            $this->postJson(self::RUTA, $entrada)->assertForbidden();
        }

        $this->autenticar('colaborador', 'institucion');
        $this->getJson(self::RUTA)->assertForbidden();
        $this->getJson(self::RUTA.'/'.PHP_INT_MAX.'/ceremonias/1')->assertForbidden();
        $this->postJson(self::RUTA, [])->assertForbidden();

        $actor = $this->autenticar('administrador');
        $id = $this->postJson(self::RUTA, $entrada)->assertCreated()->json('data.id');
        $this->app->instance('env', 'production');
        $this->getJson(self::RUTA.'/'.$id)->assertForbidden();
        $this->postJson(self::RUTA, $entrada)->assertForbidden();
        $this->assertSame(1, Evento::query()->where('actor_id', $actor->id)->count());
    }

    public function test_instituciones_del_ensayo_usan_la_misma_concesion(): void
    {
        $ruta = '/api/instituciones';
        $this->getJson($ruta)->assertUnauthorized();
        $this->autenticar('colaborador');
        $this->getJson($ruta)->assertForbidden();

        $this->autenticar('administrador');
        $institucion = $this->institucion();
        $sede = $institucion->sedes()->create(['nombre' => 'Sede QA']);
        $this->getJson($ruta)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonFragment([
                'id' => $institucion->id, 'nombre' => 'Institución ficticia', 'tipo' => 'universidad',
                'sedes' => [['id' => $sede->id, 'nombre' => 'Sede QA']],
            ]);
        $this->app->instance('env', 'production');
        $this->getJson($ruta)->assertForbidden();
    }

    public function test_comando_de_ensayo_prepara_fixtures_idempotentes_y_suspende_la_cuenta_al_cerrar(): void
    {
        $_SERVER['ME_QA_CLAVE'] = 'Clave-ficticia-solo-QA';
        try {
            $this->artisan('qa:ensayo-eventos', ['accion' => 'preparar'])->assertSuccessful();
            $this->artisan('qa:ensayo-eventos', ['accion' => 'preparar'])->assertSuccessful();
        } finally {
            unset($_SERVER['ME_QA_CLAVE']);
        }

        foreach (EnsayoEventos::INSTITUCIONES as $institucion) {
            $sedes = Institucion::query()->where($institucion)->sole()->sedes();
            $this->assertSame(1, $sedes->where('nombre', 'Sede Principal')->count());
        }
        $cuenta = User::query()->where('email', EnsayoEventos::CORREO)->sole();
        $this->assertTrue($cuenta->activa);
        $this->assertSame(['administrador'], $cuenta->codigosDeAcceso());

        $this->artisan('qa:ensayo-eventos', ['accion' => 'cerrar'])->assertSuccessful();
        $this->assertFalse($cuenta->fresh()->activa);
        $this->assertSame($cuenta->version_sesion + 1, $cuenta->fresh()->version_sesion);
        $this->artisan('qa:ensayo-eventos', ['accion' => 'preparar'])->assertFailed();
    }

    public function test_reintento_revalida_rol_y_version_de_sesion(): void
    {
        $actor = $this->autenticar('administrador');
        $entrada = $this->entrada($this->institucion());
        $id = $this->postJson(self::RUTA, $entrada)->assertCreated()->json('data.id');
        $admin = $actor->roles()->firstOrFail();
        $actor->roles()->detach($admin);
        $this->postJson(self::RUTA, $entrada)->assertForbidden();
        $this->getJson(self::RUTA.'/'.$id)->assertForbidden();

        $actor->roles()->attach($admin);
        User::query()->whereKey($actor->id)->increment('version_sesion');
        $this->postJson(self::RUTA, $entrada)->assertUnauthorized();
        $this->assertSame(1, Evento::query()->where('actor_id', $actor->id)->count());
    }

    public function test_alta_de_la_spa_exige_csrf(): void
    {
        config([
            'app.key' => 'base64:'.base64_encode(random_bytes(32)),
            'sanctum.stateful' => ['127.0.0.1:5173'],
        ]);
        $this->app->bind(PreventRequestForgery::class, function ($app) {
            return new class($app, $app['encrypter']) extends PreventRequestForgery
            {
                protected function runningUnitTests(): bool
                {
                    return false;
                }
            };
        });
        $actor = $this->autenticar('administrador');
        $entrada = $this->entrada($this->institucion());

        $this->postJson(self::RUTA, $entrada, ['Origin' => 'http://127.0.0.1:5173'])->assertStatus(419);
        $this->assertDatabaseMissing('eventos', ['actor_id' => $actor->id]);
    }

    private function autenticar(string ...$codigos): User
    {
        $actor = User::factory()->create();
        $actor->roles()->attach(Rol::query()->whereIn('codigo', $codigos)->pluck('id'));
        $this->actingAs($actor->refresh(), 'web');

        return $actor;
    }

    private function institucion(): Institucion
    {
        return Institucion::query()->create(['nombre' => 'Institución ficticia', 'tipo' => 'universidad']);
    }

    private function entrada(Institucion $institucion, array $ajustes = []): array
    {
        return array_replace([
            'institucion_id' => $institucion->id,
            'sede_id' => $institucion->sedes()->create(['nombre' => 'Sede QA'])->id,
            'operation_id' => (string) Str::uuid(),
            'fecha' => '2099-02-25',
            'numero_ceremonias' => 3,
        ], $ajustes);
    }
}
