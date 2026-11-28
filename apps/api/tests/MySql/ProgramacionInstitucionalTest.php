<?php

namespace Tests\MySql;

use App\Models\Rol;
use App\Models\User;
use App\Models\VinculoInstitucional;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProgramacionInstitucionalTest extends CasoMySql
{
    protected array $tablas = [
        'users', 'roles', 'rol_user', 'instituciones', 'sedes', 'solicitudes_institucionales',
        'vinculos_institucionales', 'eventos', 'ceremonias', 'graduandos', 'registros',
    ];

    public function test_cada_representante_ve_exclusivamente_su_institucion_y_sede(): void
    {
        $actorA = $this->cuenta('institucion');
        $actorB = $this->cuenta('institucion');
        $administrador = $this->cuenta('administrador');
        [$vinculoA, $institucionA, $sedeA] = $this->vinculo($actorA);
        [$vinculoB, $institucionB, $sedeB] = $this->vinculo($actorB);
        $otraSedeA = DB::table('sedes')->insertGetId(['institucion_id' => $institucionA, 'nombre' => 'Otra sede']);
        $eventoB = $this->evento($actorB, $institucionB, $sedeB);
        $eventoOtraSede = $this->evento($actorA, $institucionA, $otraSedeA);
        $eventoSinSede = $this->evento($actorA, $institucionA, null);
        $ceremoniaHistorica = DB::table('ceremonias')->insertGetId([
            'evento_id' => $eventoSinSede, 'nombre' => 'Ceremonia histórica', 'orden' => 1,
        ]);
        $graduando = DB::table('graduandos')->insertGetId(['nombre_completo' => 'Graduando QA']);
        $registro = DB::table('registros')->insertGetId([
            'graduando_id' => $graduando, 'ceremonia_id' => $ceremoniaHistorica, 'actor_id' => $administrador->id,
            'operation_id' => (string) Str::uuid(), 'huella_solicitud' => str_repeat('c', 64),
        ]);
        $historico = DB::table('eventos')->find($eventoSinSede);
        $registroPrevio = DB::table('registros')->find($registro);
        $eventoA = $this->actingAs($administrador->refresh())->postJson('/api/eventos', [
            'institucion_id' => $institucionA, 'sede_id' => $sedeA,
            'fecha' => '2026-12-17', 'lugar' => 'Auditorio QA', 'numero_ceremonias' => 2,
            'operation_id' => (string) Str::uuid(),
        ])->assertCreated()->json('data.id');
        $this->assertEquals($historico, DB::table('eventos')->find($eventoSinSede));
        $this->assertEquals($registroPrevio, DB::table('registros')->find($registro));
        $this->getJson('/api/eventos/'.$eventoSinSede)->assertOk()->assertJsonPath('data.sede', null);
        DB::table('ceremonias')->where('evento_id', $eventoA)->where('orden', 1)->update(['hora' => '08:30:00']);
        DB::table('ceremonias')->insert([
            ['evento_id' => $eventoB, 'nombre' => 'Ceremonia B', 'orden' => 1, 'hora' => null],
        ]);
        $rutaA = $this->ruta($vinculoA);
        $rutaB = $this->ruta($vinculoB);

        $this->actingAs($actorA)->getJson('/api/mi-institucion')->assertOk()
            ->assertJsonPath('data.0.vinculo_id', $vinculoA);
        $listadoA = $this->getJson($rutaA.'?institucion_id='.$institucionB.'&sede_id='.$sedeB)->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $eventoA)
            ->assertJsonPath('data.0.sede.id', $sedeA)
            ->assertJsonPath('data.0.ceremonias.0.nombre', 'Ceremonia 1')
            ->assertJsonPath('data.0.ceremonias.0.hora', '08:30:00')
            ->assertJsonPath('data.0.ceremonias.1.orden', 2)
            ->assertJsonPath('data.0.ceremonias.1.hora', null)
            ->assertJsonMissingPath('data.0.actor_id')
            ->assertJsonMissingPath('data.0.pagos')
            ->assertJsonMissingPath('data.0.registros');
        $this->getJson($rutaA.'/'.$eventoA)->assertOk()->assertExactJson(['data' => $listadoA->json('data.0')]);
        $this->getJson($rutaA.'/'.$eventoB)->assertNotFound();
        $this->getJson($rutaA.'/'.$eventoOtraSede)->assertNotFound();
        $this->getJson($rutaA.'/'.$eventoSinSede)->assertNotFound();
        $this->getJson($rutaB)->assertForbidden();
        $this->getJson('/api/eventos/'.$eventoA)->assertForbidden();
        $this->postJson($rutaA)->assertMethodNotAllowed();

        $this->actingAs($actorB)->getJson($rutaB)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $eventoB)
            ->assertJsonPath('data.0.ceremonias.0.nombre', 'Ceremonia B');
        $this->getJson($rutaB.'/'.$eventoA)->assertNotFound();
    }

    public function test_ambito_elegido_paginacion_vacio_y_vinculo_revocado(): void
    {
        $actor = $this->cuenta('institucion');
        [$primero, $institucion, $sede] = $this->vinculo($actor);
        [$segundo] = $this->vinculo($actor);
        for ($indice = 0; $indice < 26; $indice++) {
            $ultimo = $this->evento($actor, $institucion, $sede);
        }

        $this->actingAs($actor)->getJson('/api/mi-institucion')->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('data.1.vinculo_id', $segundo);
        $this->getJson($this->ruta($segundo))->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('links.next', null);
        $pagina = $this->getJson($this->ruta($primero))->assertOk()->assertJsonCount(25, 'data')
            ->assertJsonPath('data.0.id', $ultimo);
        $this->getJson($pagina->json('links.next'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('links.next', null);
        $this->getJson($this->ruta($primero).'?page=-1')->assertUnprocessable();
        DB::table('vinculos_institucionales')->where('id', $primero)->update(['estado' => VinculoInstitucional::PENDIENTE]);
        $this->getJson($this->ruta($primero))->assertForbidden();
    }

    public function test_exige_sesion_cuenta_activa_correo_verificado_rol_y_vinculo_activo(): void
    {
        $pendiente = $this->cuenta('institucion');
        [$vinculoPendiente] = $this->vinculo($pendiente, VinculoInstitucional::PENDIENTE);
        $graduando = $this->cuenta('graduando');
        [$vinculoGraduando] = $this->vinculo($graduando);
        $sinVerificar = $this->cuenta('institucion', ['email_verified_at' => null]);
        [$vinculoSinVerificar] = $this->vinculo($sinVerificar);
        $inactiva = $this->cuenta('institucion', ['activa' => false]);
        [$vinculoInactiva] = $this->vinculo($inactiva);

        $this->getJson($this->ruta($vinculoPendiente))->assertUnauthorized();
        $this->actingAs($pendiente)->getJson($this->ruta($vinculoPendiente))->assertForbidden();
        $this->actingAs($graduando)->getJson($this->ruta($vinculoGraduando))->assertForbidden();
        $this->actingAs($sinVerificar)->getJson($this->ruta($vinculoSinVerificar))->assertForbidden();
        $this->actingAs($inactiva)->getJson($this->ruta($vinculoInactiva))->assertForbidden();
    }

    public function test_la_base_rechaza_asignar_un_evento_a_una_sede_ajena(): void
    {
        $actor = $this->cuenta('institucion');
        [, $institucion] = $this->vinculo($actor);
        [, , $sedeAjena] = $this->vinculo($actor);

        $this->expectException(QueryException::class);
        $this->evento($actor, $institucion, $sedeAjena);
    }

    private function ruta(int $vinculo): string
    {
        return route('mi-institucion.eventos.index', ['vinculo' => $vinculo], absolute: false);
    }

    private function cuenta(string $rol, array $atributos = []): User
    {
        $usuario = User::factory()->create($atributos + ['activa' => true]);
        $usuario->roles()->attach(Rol::query()->where('codigo', $rol)->firstOrFail());

        return $usuario;
    }

    private function vinculo(User $usuario, string $estado = VinculoInstitucional::ACTIVO): array
    {
        $institucion = DB::table('instituciones')->insertGetId(['nombre' => 'Institución QA', 'tipo' => 'colegio']);
        $sede = DB::table('sedes')->insertGetId(['institucion_id' => $institucion, 'nombre' => 'Sede QA']);
        $solicitud = DB::table('solicitudes_institucionales')->insertGetId([
            'estado' => 'aprobada', 'tipo' => 'colegio', 'razon_social' => 'Institución QA',
            'nit' => '900789123', 'sede_nombre' => 'Sede QA', 'representante_nombre' => 'Representante QA',
            'email' => $usuario->email, 'telefono' => '3000000000', 'huella_solicitud' => str_repeat('a', 64),
        ]);
        $vinculo = DB::table('vinculos_institucionales')->insertGetId([
            'user_id' => $usuario->id, 'institucion_id' => $institucion, 'sede_id' => $sede,
            'solicitud_id' => $solicitud, 'estado' => $estado,
        ]);

        return [$vinculo, $institucion, $sede];
    }

    private function evento(User $actor, int $institucion, ?int $sede): int
    {
        return DB::table('eventos')->insertGetId([
            'actor_id' => $actor->id, 'institucion_id' => $institucion, 'sede_id' => $sede,
            'fecha' => '2026-12-16', 'lugar' => 'Auditorio QA', 'operation_id' => (string) Str::uuid(),
            'huella_solicitud' => str_repeat('b', 64),
        ]);
    }
}
