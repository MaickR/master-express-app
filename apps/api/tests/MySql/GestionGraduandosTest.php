<?php

namespace Tests\MySql;

use App\Actions\ProgramarEvento;
use App\Models\Evento;
use App\Models\Graduando;
use App\Models\Institucion;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GestionGraduandosTest extends CasoMySql
{
    public function test_perfil_documento_textual_idempotencia_duplicados_revision_y_ambitos(): void
    {
        $actor = $this->cuenta('colaborador');
        $otro = $this->cuenta('colaborador');
        $admin = $this->cuenta('administrador');
        $datos = $this->datos();
        $this->getJson('/api/graduandos')->assertUnauthorized();
        $this->actingAs($actor);
        $id = $this->postJson('/api/graduandos', $datos)->assertCreated()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.numero_documento', '00001234')->assertJsonPath('data.correo', 'persona@example.invalid')->json('data.id');
        $this->postJson('/api/graduandos', $datos)->assertCreated()->assertJsonPath('data.id', $id);
        $this->postJson('/api/graduandos', array_replace($datos, ['nombre_completo' => 'Otro nombre']))->assertConflict();
        $this->postJson('/api/graduandos', array_replace($datos, ['operation_id' => (string) Str::uuid()]))->assertConflict();
        $edicion = array_diff_key($datos, ['operation_id' => true]) + ['revision' => 1];
        $edicion['nombre_completo'] = 'Nombre corregido';
        $this->postJson('/api/graduandos/'.$id, $edicion)->assertOk()->assertJsonPath('data.revision', 2);
        $this->postJson('/api/graduandos/'.$id, $edicion)->assertConflict();
        $this->getJson('/api/graduandos/'.$id)->assertOk()->assertJsonPath('data.nombre_completo', 'Nombre corregido');
        $this->assertDatabaseHas('graduandos', ['id' => $id, 'numero_documento' => '00001234', 'creado_por' => $actor->id]);
        $this->actingAs($otro)->getJson('/api/graduandos/'.$id)->assertNotFound();
        $this->getJson('/api/graduandos')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/graduandos/'.$id, array_replace($edicion, ['revision' => 2]))->assertNotFound();
        $this->actingAs($admin)->getJson('/api/graduandos/'.$id)->assertOk();
        $this->postJson('/api/graduandos/'.$id, array_replace($edicion, ['revision' => 2]))->assertOk();
        $this->assertDatabaseCount('graduandos', 1);
    }

    public function test_api_invalida_roles_sin_permiso_y_homonimos_sin_fusion(): void
    {
        $actor = $this->cuenta('colaborador');
        $this->actingAs($actor);
        foreach ([['numero_documento' => 123], ['numero_documento' => '1e3'], ['nombre_completo' => ' '], ['correo' => 'invalido'], ['telefono' => 'abc'], ['tipo_documento' => 'CE'], ['creado_por' => $actor->id], ['revision' => 1]] as $invalido) {
            $this->postJson('/api/graduandos', array_replace($this->datos(), $invalido))->assertUnprocessable();
        }
        $datos = array_replace($this->datos(), ['tipo_documento' => null, 'numero_documento' => null]);
        $this->postJson('/api/graduandos', $datos)->assertCreated();
        $this->postJson('/api/graduandos', array_replace($datos, ['operation_id' => (string) Str::uuid()]))->assertCreated();
        $this->assertDatabaseCount('graduandos', 2);
        foreach (['vendedor', 'finanzas', 'inventario'] as $rol) {
            $this->actingAs($this->cuenta($rol))->getJson('/api/graduandos')->assertForbidden();
            $this->postJson('/api/graduandos', $this->datos())->assertForbidden();
        }
        $this->actingAs($actor);
        $actor->forceFill(['activa' => false])->save();
        $this->getJson('/api/graduandos')->assertForbidden();
    }

    public function test_inscripcion_idempotente_historial_cancelacion_y_vinculo_de_cuenta(): void
    {
        $admin = $this->cuenta('administrador');
        $actor = $this->cuenta('colaborador');
        $cuenta = $this->cuenta('graduando');
        $evento = $this->evento($admin);
        $this->actingAs($actor);
        $id = $this->postJson('/api/graduandos', $this->datos())->assertCreated()->json('data.id');
        $datos = ['operation_id' => (string) Str::uuid(), 'evento_id' => $evento->id,
            'graduando_id' => $id, 'programa_academico' => 'Programa de prueba'];
        $ruta = '/api/ceremonias/'.$evento->ceremonias->first()->id.'/registros';
        $registro = $this->postJson($ruta, $datos)->assertCreated()->json('data.id');
        $this->postJson($ruta, $datos)->assertCreated()->assertJsonPath('data.id', $registro);
        $this->postJson($ruta, array_replace($datos, ['operation_id' => (string) Str::uuid()]))->assertConflict();
        $otro = $this->cuenta('colaborador');
        $this->actingAs($otro)->postJson($ruta, array_replace($datos, ['operation_id' => (string) Str::uuid()]))->assertNotFound();
        $this->getJson('/api/registros/'.$registro)->assertNotFound();
        $this->actingAs($admin)->postJson('/api/administracion/vinculos-graduandos', ['graduando_id' => $id, 'cuenta_id' => $cuenta->id])->assertCreated();
        $this->actingAs($cuenta)->getJson('/api/graduandos')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/registros/'.$registro)->assertOk();
        $this->postJson($ruta, $datos)->assertForbidden();
        $this->actingAs($admin)->postJson('/api/eventos/'.$evento->id.'/cancelacion')->assertOk();
        $this->actingAs($actor)->postJson($ruta, $datos)->assertCreated()->assertJsonPath('data.id', $registro);
        $nuevo = $this->postJson('/api/graduandos', array_replace($this->datos(), ['numero_documento' => '00009999']))->assertCreated()->json('data.id');
        $this->postJson($ruta, array_replace($datos, ['graduando_id' => $nuevo, 'operation_id' => (string) Str::uuid()]))->assertConflict();
        $this->assertDatabaseCount('registros', 1);
        $this->assertDatabaseHas('registros', ['id' => $registro, 'graduando_id' => $id, 'ceremonia_id' => $evento->ceremonias->first()->id]);
    }

    public function test_paginacion_busqueda_y_vinculacion_en_servidor(): void
    {
        $admin = $this->cuenta('administrador');
        for ($i = 0; $i < 26; $i++) {
            Graduando::query()->create(['nombre_completo' => 'Persona '.$i]);
        }
        $this->actingAs($admin)->getJson('/api/graduandos')->assertOk()->assertJsonCount(25, 'data')->assertJsonPath('total', 26)->assertJsonPath('hayMas', true);
        $this->getJson('/api/graduandos?page=2')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/graduandos?buscar=Persona%2025')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/graduandos?vinculacion=activa')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/graduandos?buscar=%25')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/graduandos?page=0')->assertUnprocessable();
        $cuenta = $this->cuenta('graduando');
        $fila = Graduando::query()->orderBy('id')->first();
        $this->postJson('/api/administracion/vinculos-graduandos', ['graduando_id' => $fila->id, 'cuenta_id' => $cuenta->id])->assertCreated();
        $this->getJson('/api/administracion/vinculos-graduandos/graduandos?buscar=Persona%2025')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/administracion/vinculos-graduandos/graduandos?vinculacion=activa')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/administracion/vinculos-graduandos/cuentas?buscar=ausente')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/administracion/vinculos-graduandos/graduandos?vinculacion=inventada')->assertUnprocessable();
        $this->getJson('/api/graduandos?buscar=Persona&institucion_id=999999')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_institucion_no_cruza_sede_ni_inscripciones_de_una_persona_compartida(): void
    {
        $admin = $this->cuenta('administrador');
        $institucional = $this->cuenta('institucion');
        $evento = $this->evento($admin);
        $ajeno = $this->evento($admin);
        $solicitud = DB::table('solicitudes_institucionales')->insertGetId([
            'estado' => 'aprobada', 'tipo' => 'colegio', 'razon_social' => 'Institución QA', 'nit' => '900789123',
            'sede_nombre' => 'Sede QA', 'representante_nombre' => 'Representante QA', 'email' => $institucional->email,
            'telefono' => '3000000000', 'huella_solicitud' => str_repeat('a', 64),
        ]);
        $vinculo = DB::table('vinculos_institucionales')->insertGetId(['user_id' => $institucional->id,
            'institucion_id' => $evento->institucion_id, 'sede_id' => $evento->sede_id, 'solicitud_id' => $solicitud, 'estado' => 'activo']);
        $this->actingAs($admin);
        $id = $this->postJson('/api/graduandos', $this->datos())->assertCreated()->json('data.id');
        foreach ([$evento, $ajeno] as $programacion) {
            $respuesta = $this->postJson('/api/ceremonias/'.$programacion->ceremonias->first()->id.'/registros', [
                'operation_id' => (string) Str::uuid(), 'evento_id' => $programacion->id, 'graduando_id' => $id,
            ])->assertCreated();
        }
        $ajenoId = $respuesta->json('data.id');
        $this->actingAs($institucional)->getJson('/api/graduandos')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.puede_editar', false);
        $this->getJson('/api/registros?graduando_id='.$id)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/registros/'.$ajenoId)->assertNotFound();
        $this->getJson('/api/graduandos/filtros')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.institucion.id', $evento->institucion_id);
        $this->getJson('/api/graduandos?institucion_id='.$evento->institucion_id.'&sede_id='.$evento->sede_id.'&evento_id='.$evento->id.'&ceremonia_id='.$evento->ceremonias->first()->id)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/graduandos?institucion_id='.$ajeno->institucion_id)->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/graduandos/'.$id, ['nombre_completo' => 'Ataque', 'revision' => 1])->assertForbidden();
        $sedeAjena = $evento->institucion->sedes()->create(['nombre' => 'Otra sede QA']);
        DB::table('vinculos_institucionales')->where('id', $vinculo)->update(['sede_id' => $sedeAjena->id]);
        $this->getJson('/api/graduandos')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/registros')->assertOk()->assertJsonCount(0, 'data');
        DB::table('vinculos_institucionales')->where('id', $vinculo)->update(['sede_id' => $evento->sede_id]);
        DB::table('vinculos_institucionales')->where('id', $vinculo)->update(['estado' => 'pendiente']);
        $this->getJson('/api/graduandos/'.$id)->assertForbidden();
    }

    public function test_activacion_explicita_fuera_del_ensayo_y_validacion_de_filtros(): void
    {
        $actor = $this->cuenta('administrador');
        $this->actingAs($actor);
        $this->app->instance('env', 'production');
        config(['graduandos.habilitados' => false]);
        $this->getJson('/api/graduandos')->assertForbidden();
        config(['graduandos.habilitados' => true]);
        $this->postJson('/api/graduandos', $this->datos())->assertCreated();
        $this->getJson('/api/graduandos?buscar=persona%40example.invalid')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/graduandos?buscar=00001234')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/graduandos?buscar[]=entrada')->assertUnprocessable();
        $this->getJson('/api/graduandos?evento_id=texto')->assertUnprocessable();
    }

    private function cuenta(string $rol): User
    {
        $cuenta = User::factory()->create();
        $cuenta->roles()->attach(Rol::query()->where('codigo', $rol)->sole()->id);

        return $cuenta->refresh();
    }

    private function datos(): array
    {
        return ['nombre_completo' => ' Persona de prueba ', 'tipo_documento' => 'CC', 'numero_documento' => '00001234',
            'correo' => ' PERSONA@example.invalid ', 'telefono' => '3000000000', 'operation_id' => (string) Str::uuid()];
    }

    private function evento(User $admin): Evento
    {
        $institucion = Institucion::query()->create(['nombre' => 'Institución QA', 'tipo' => 'colegio']);

        return app(ProgramarEvento::class)->ejecutar($admin, ['institucion_id' => $institucion->id,
            'sede_id' => $institucion->sedes()->create(['nombre' => 'Sede QA'])->id, 'fecha' => '2099-03-01',
            'numero_ceremonias' => 1, 'operation_id' => (string) Str::uuid()]);
    }
}
