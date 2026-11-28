<?php

namespace Tests\MySql;

use App\Actions\ProgramarEvento;
use App\Models\AuditoriaVinculoGraduando;
use App\Models\Ceremonia;
use App\Models\Evento;
use App\Models\Graduando;
use App\Models\Institucion;
use App\Models\Registro;
use App\Models\Rol;
use App\Models\User;
use App\Models\VinculoGraduando;
use App\Models\VinculoInstitucional;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class VinculacionGraduandosTest extends CasoMySql
{
    protected array $tablas = [
        'users', 'roles', 'rol_user', 'instituciones', 'eventos', 'ceremonias',
        'graduandos', 'registros', 'vinculos_de_graduandos', 'auditoria_vinculos_graduandos',
        'sedes', 'solicitudes_institucionales', 'vinculos_institucionales',
    ];

    private User $administrador;

    protected function setUp(): void
    {
        parent::setUp();
        $this->administrador = $this->usuario('administrador');
    }

    public function test_administrador_vincula_por_id_sin_usar_datos_personales(): void
    {
        $cuenta = $this->cuentaGraduando('Ana Distinta');
        $cuenta->forceFill(['numero_documento' => 'DOC-FICTICIO-NO-EXPONER', 'telefono' => '3000000099'])->save();
        $graduando = Graduando::query()->create(['nombre_completo' => 'Carlos Operativo']);
        $homonimo = Graduando::query()->create(['nombre_completo' => 'Carlos Operativo']);
        $this->actingAs($this->administrador, 'web');

        $respuesta = $this->postJson($this->ruta(), [
            'graduando_id' => $graduando->id,
            'cuenta_id' => $cuenta->id,
        ])->assertCreated()->assertHeader('Cache-Control', 'no-store, private');

        $respuesta->assertJsonPath('data.estado', VinculoGraduando::ACTIVO)
            ->assertJsonPath('data.graduando.id', $graduando->id)
            ->assertJsonPath('data.graduando.homonimo', true)
            ->assertJsonPath('data.cuenta.id', $cuenta->id)
            ->assertJsonPath('data.administrador.id', $this->administrador->id)
            ->assertJsonMissingPath('data.cuenta.numero_documento')
            ->assertJsonMissingPath('data.cuenta.telefono');
        $this->assertNotEmpty($respuesta->json('data.decidida_en'));
        $cuerpo = $respuesta->getContent();
        $this->assertIsString($cuerpo);
        $this->assertStringNotContainsString('DOC-FICTICIO-NO-EXPONER', $cuerpo);
        $this->assertStringNotContainsString('3000000099', $cuerpo);

        $this->assertDatabaseHas('vinculos_de_graduandos', [
            'user_id' => $cuenta->id,
            'graduando_id' => $graduando->id,
            'decidido_por' => $this->administrador->id,
            'estado' => VinculoGraduando::ACTIVO,
        ]);
        $this->assertDatabaseMissing('vinculos_de_graduandos', ['graduando_id' => $homonimo->id]);
        $this->assertSame('Carlos Operativo', $graduando->refresh()->nombre_completo);
        $this->assertFalse(Schema::hasColumn('graduandos', 'user_id'));
        $this->assertFalse(Schema::hasColumn('registros', 'estado_pago'));

        $this->getJson('/api/administracion/vinculos-graduandos/graduandos')
            ->assertOk()
            ->assertJsonPath('data.0.vinculo.cuenta_id', $cuenta->id)
            ->assertJsonMissingPath('data.0.vinculo.numero_documento');
        $this->getJson('/api/administracion/vinculos-graduandos/cuentas')
            ->assertOk()
            ->assertJsonMissing(['id' => $cuenta->id]);
    }

    public function test_graduando_y_colaborador_no_pueden_vincular_ni_consultar(): void
    {
        $cuenta = $this->cuentaGraduando();
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona ficticia']);
        $cuerpo = ['graduando_id' => $graduando->id, 'cuenta_id' => $cuenta->id];

        $this->postJson($this->ruta(), $cuerpo)->assertUnauthorized();
        $this->getJson('/api/administracion/vinculos-graduandos/cuentas')->assertUnauthorized();

        $this->actingAs($cuenta, 'web');
        $this->postJson($this->ruta(), $cuerpo)->assertForbidden();
        $this->getJson('/api/administracion/vinculos-graduandos/graduandos')->assertForbidden();
        $this->getJson('/api/administracion/vinculos-graduandos/cuentas')->assertForbidden();

        $this->actingAs($this->usuario('colaborador'), 'web');
        $this->postJson($this->ruta(), $cuerpo)->assertForbidden()
            ->assertJsonPath('message', 'Tu cuenta no puede vincular graduandos.');
        $this->getJson('/api/administracion/vinculos-graduandos/cuentas')->assertForbidden();
        $this->assertDatabaseCount('vinculos_de_graduandos', 0);
    }

    public function test_rechaza_cuenta_o_graduando_inexistente_y_cuenta_no_elegible(): void
    {
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona ficticia']);
        $cuenta = $this->cuentaGraduando();
        $this->actingAs($this->administrador, 'web');

        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => PHP_INT_MAX])
            ->assertNotFound()->assertJsonPath('message', 'La cuenta no existe.');
        $this->postJson($this->ruta(), ['graduando_id' => PHP_INT_MAX, 'cuenta_id' => $cuenta->id])
            ->assertNotFound()->assertJsonPath('message', 'El graduando no existe.');

        $sinRol = $this->usuario('institucion');
        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $sinRol->id])
            ->assertUnprocessable()->assertJsonPath('message', 'La cuenta no tiene el rol Graduando.');

        $inactiva = $this->cuentaGraduando();
        $inactiva->forceFill(['activa' => false])->save();
        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $inactiva->id])
            ->assertUnprocessable()->assertJsonPath('message', 'La cuenta de Graduando no está activa.');

        $sinCorreo = $this->cuentaGraduando();
        $sinCorreo->forceFill(['email_verified_at' => null])->save();
        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $sinCorreo->id])
            ->assertUnprocessable()->assertJsonPath('message', 'La cuenta de Graduando no tiene el correo verificado.');

        $this->postJson($this->ruta(), [
            'graduando_id' => $graduando->id,
            'cuenta_id' => $cuenta->id,
            'decidido_por' => $sinRol->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('vinculo');
        $this->assertDatabaseCount('vinculos_de_graduandos', 0);
    }

    public function test_duplicado_y_conflicto_no_conceden_otro_acceso(): void
    {
        $primera = $this->cuentaGraduando('Primera Cuenta');
        $segunda = $this->cuentaGraduando('Segunda Cuenta');
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona ficticia']);
        $otro = Graduando::query()->create(['nombre_completo' => 'Otra persona']);
        $this->actingAs($this->administrador, 'web');

        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $primera->id])->assertCreated();
        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $primera->id])
            ->assertConflict()->assertJsonPath('message', 'Esta cuenta ya está vinculada con este graduando.');
        $this->postJson($this->ruta(), ['graduando_id' => $otro->id, 'cuenta_id' => $primera->id])
            ->assertConflict()
            ->assertJsonPath('message', 'La cuenta o el graduando ya tiene otra vinculación. No se concedió acceso y la relación queda pendiente de revisión.');
        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $segunda->id])
            ->assertConflict();

        $this->assertDatabaseCount('vinculos_de_graduandos', 1);
        $this->assertSame(1, VinculoGraduando::query()->where('graduando_id', $graduando->id)->count());
        $this->assertSame(0, VinculoGraduando::query()->where('graduando_id', $otro->id)->count());
    }

    public function test_revocacion_de_sesion_impide_vincular_y_las_claves_protegen_el_par(): void
    {
        $cuenta = $this->cuentaGraduando();
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona ficticia']);
        $this->actingAs($this->administrador, 'web');
        User::query()->whereKey($this->administrador->id)->increment('version_sesion');

        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $cuenta->id])
            ->assertUnauthorized()->assertJsonPath('message', 'Tu sesión terminó.');
        $this->assertDatabaseCount('vinculos_de_graduandos', 0);

        $this->administrador->refresh();
        $this->actingAs($this->administrador, 'web');
        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $cuenta->id])->assertCreated();
        $vinculo = VinculoGraduando::query()->sole();
        $copia = $vinculo->getRawOriginal();
        unset($copia['id']);
        $this->assertThrows(fn () => DB::table('vinculos_de_graduandos')->insert($copia), UniqueConstraintViolationException::class);
        foreach (['user_id', 'graduando_id', 'decidido_por'] as $campo) {
            $this->assertThrows(fn () => DB::table('vinculos_de_graduandos')->insert(
                array_replace($copia, [$campo => PHP_INT_MAX, 'user_id' => $campo === 'user_id' ? PHP_INT_MAX : $copia['user_id'] + 1]),
            ), QueryException::class);
        }
        $this->assertThrows(fn () => $vinculo->cuenta()->firstOrFail()->delete(), QueryException::class);
    }

    public function test_la_vinculacion_concede_consulta_propia_sin_cambiar_inscripciones(): void
    {
        $colaborador = $this->usuario('colaborador');
        $ceremonia = $this->ceremonia();
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona inscrita']);
        $graduando->forceFill(['creado_por' => $colaborador->id])->save();
        $this->actingAs($colaborador, 'web');
        $id = $this->postJson('/api/ceremonias/'.$ceremonia->id.'/registros', [
            'operation_id' => (string) Str::uuid(),
            'evento_id' => $ceremonia->evento_id,
            'graduando_id' => $graduando->id,
            'programa_academico' => 'Programa ficticio',
        ])->assertCreated()->json('data.id');
        $antes = Registro::query()->findOrFail($id)->getRawOriginal();

        $cuenta = $this->cuentaGraduando();
        $this->actingAs($this->administrador, 'web');
        $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $cuenta->id])->assertCreated();
        $this->getJson('/api/administracion/vinculos-graduandos/graduandos?page=0')
            ->assertUnprocessable()->assertJsonValidationErrors('page');
        $this->postJson('/api/ceremonias/'.$ceremonia->id.'/registros', [
            'operation_id' => (string) Str::uuid(),
            'evento_id' => $ceremonia->evento_id,
            'graduando_id' => $graduando->id,
            'programa_academico' => 'Programa ficticio',
        ])->assertConflict();

        $this->actingAs($cuenta, 'web');
        $this->getJson('/api/registros/'.$id)->assertOk();
        $this->assertSame($antes, Registro::query()->findOrFail($id)->getRawOriginal());
        $this->assertDatabaseCount('registros', 1);
    }

    public function test_el_listado_de_cuentas_solo_incluye_graduandos_elegibles(): void
    {
        $elegible = $this->cuentaGraduando('Cuenta Elegible');
        $interna = $this->usuario('colaborador');
        $interna->forceFill(['email' => 'colaborador-'.Str::uuid().'@example.invalid'])->save();
        $this->actingAs($this->administrador, 'web');

        $cuerpo = $this->getJson('/api/administracion/vinculos-graduandos/cuentas')->assertOk()->getContent();
        $this->assertIsString($cuerpo);
        $this->assertStringContainsString($elegible->email, $cuerpo);
        $this->assertStringNotContainsString($interna->email, $cuerpo);
        $this->assertStringNotContainsString($this->administrador->email, $cuerpo);
    }

    public function test_el_listado_y_la_vinculacion_respetan_los_roles_efectivos_de_sesion(): void
    {
        $cuenta = $this->cuentaGraduando();
        $externa = $this->usuario('graduando', 'institucion');
        $internas = [
            'administrador' => $this->usuario('administrador', 'graduando'),
            'colaborador' => $this->usuario('colaborador', 'graduando'),
        ];
        $institucion = Institucion::query()->create(['nombre' => 'Institución ficticia', 'tipo' => 'colegio']);
        $sedeId = DB::table('sedes')->insertGetId(['institucion_id' => $institucion->id, 'nombre' => 'Sede ficticia']);
        $solicitudId = DB::table('solicitudes_institucionales')->insertGetId([
            'estado' => 'aprobada', 'tipo' => 'colegio', 'razon_social' => $institucion->nombre,
            'nit' => '900789123', 'sede_nombre' => 'Sede ficticia', 'representante_nombre' => $externa->name,
            'email' => $externa->email, 'telefono' => '3000000000', 'huella_solicitud' => str_repeat('a', 64),
        ]);
        DB::table('vinculos_institucionales')->insert([
            'user_id' => $externa->id, 'institucion_id' => $institucion->id, 'sede_id' => $sedeId,
            'solicitud_id' => $solicitudId, 'estado' => VinculoInstitucional::ACTIVO,
        ]);
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona ficticia']);
        $this->assertSame(['graduando'], $cuenta->codigosDeSesion());
        $this->assertSame(['graduando', 'institucion'], $externa->codigosDeSesion());
        $this->actingAs($this->administrador, 'web');

        $listado = $this->getJson($this->ruta().'/cuentas')->assertOk()->json('data');
        $this->assertSame([$cuenta->id, $externa->id], array_column($listado, 'id'));

        foreach ($internas as $rol => $interna) {
            $this->assertSame([$rol], $interna->codigosDeSesion());
            $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $interna->id])
                ->assertUnprocessable();
        }
        $this->assertDatabaseCount('vinculos_de_graduandos', 0);

        $vinculoId = $this->postJson($this->ruta(), ['graduando_id' => $graduando->id, 'cuenta_id' => $externa->id])
            ->assertCreated()->assertJsonPath('data.cuenta.id', $externa->id)->json('data.id');

        foreach ($internas as $interna) {
            $this->postJson($this->ruta().'/'.$vinculoId.'/correccion', [
                'motivo' => 'Corrección de una vinculación ficticia.',
                'cuenta_id' => $interna->id,
            ])->assertUnprocessable();
        }
        $this->assertDatabaseHas('vinculos_de_graduandos', [
            'id' => $vinculoId, 'estado' => VinculoGraduando::ACTIVO, 'user_id' => $externa->id,
        ]);
        $this->assertDatabaseCount('vinculos_de_graduandos', 1);
        $this->assertDatabaseCount('auditoria_vinculos_graduandos', 1);
    }

    public function test_anulacion_y_correccion_conservan_historial_inscripciones_y_niegan_otro_ambito(): void
    {
        $colaborador = $this->usuario('colaborador');
        $primera = $this->cuentaGraduando('Cuenta Equivocada');
        $correcta = $this->cuentaGraduando('Cuenta Correcta');
        $graduando = Graduando::query()->create(['nombre_completo' => 'Persona con dos ceremonias']);
        $graduando->forceFill(['creado_por' => $colaborador->id])->save();
        $evento = $this->eventoConDosCeremonias();
        $ceremonias = $evento->ceremonias()->get();
        $this->assertCount(2, $ceremonias);
        $this->assertSame($evento->institucion_id, $evento->institucion()->value('id'));
        $this->assertTrue($evento->sede_id === null || $evento->sede()->value('institucion_id') === $evento->institucion_id);
        $this->actingAs($colaborador, 'web');
        $registros = [];
        foreach ($ceremonias as $ceremonia) {
            $this->assertSame($evento->id, $ceremonia->evento_id);
            $registros[] = $this->postJson('/api/ceremonias/'.$ceremonia->id.'/registros', [
                'operation_id' => (string) Str::uuid(),
                'evento_id' => $evento->id,
                'graduando_id' => $graduando->id,
                'programa_academico' => 'Programa ficticio '.$ceremonia->orden,
            ])->assertCreated()->json('data.id');
        }
        $antes = Registro::query()->orderBy('id')->get()->map->getRawOriginal()->all();

        $this->actingAs($this->administrador, 'web');
        $vinculoId = $this->postJson($this->ruta(), [
            'graduando_id' => $graduando->id,
            'cuenta_id' => $primera->id,
        ])->assertCreated()->json('data.id');
        $this->assertSame(1, AuditoriaVinculoGraduando::query()->where('accion', 'confirmado')->count());

        $this->actingAs($primera, 'web');
        $this->getJson('/api/mi-institucion')->assertForbidden();
        $this->getJson('/api/mi-institucion/vinculos/1/eventos')->assertForbidden();
        foreach ($registros as $id) {
            $this->getJson('/api/registros/'.$id)->assertOk();
        }

        $this->actingAs($colaborador, 'web');
        $this->postJson($this->ruta().'/'.$vinculoId.'/anulacion', [
            'motivo' => 'La cuenta no corresponde a esta persona.',
        ])->assertForbidden();

        $this->actingAs($this->administrador, 'web');
        $this->postJson($this->ruta().'/'.$vinculoId.'/anulacion', ['motivo' => 'corto'])->assertUnprocessable();
        $this->postJson($this->ruta().'/'.$vinculoId.'/correccion', [
            'motivo' => 'La cuenta correcta es otra persona ficticia.',
            'cuenta_id' => $correcta->id,
            'decidido_por' => $colaborador->id,
        ])->assertUnprocessable();
        $this->postJson($this->ruta().'/'.$vinculoId.'/correccion', [
            'motivo' => 'La cuenta correcta es otra persona ficticia.',
            'cuenta_id' => $correcta->id,
        ])->assertCreated()
            ->assertJsonPath('data.cuenta.id', $correcta->id)
            ->assertJsonPath('data.estado', 'activo')
            ->assertJsonPath('anterior.estado', 'anulado')
            ->assertJsonPath('anterior.cuenta_id', $primera->id);

        $this->assertSame('anulado', VinculoGraduando::query()->findOrFail($vinculoId)->estado);
        $this->assertNotNull(VinculoGraduando::query()->findOrFail($vinculoId)->motivo_anulacion);
        $this->assertSame(1, VinculoGraduando::query()->where('estado', 'activo')->where('user_id', $correcta->id)->count());
        $this->assertSame(2, AuditoriaVinculoGraduando::query()->where('vinculo_id', $vinculoId)->count());
        $this->assertSame($antes, Registro::query()->orderBy('id')->get()->map->getRawOriginal()->all());
        $this->assertDatabaseCount('registros', 2);

        $nuevoId = VinculoGraduando::query()->where('estado', 'activo')->value('id');
        $this->postJson($this->ruta().'/'.$nuevoId.'/anulacion', [
            'motivo' => 'Se retira el acceso de prueba sin mover ceremonias.',
        ])->assertOk()->assertJsonPath('data.estado', 'anulado');
        $this->postJson($this->ruta().'/'.$nuevoId.'/anulacion', [
            'motivo' => 'Se retira el acceso de prueba sin mover ceremonias.',
        ])->assertConflict();
        $this->assertSame(1, AuditoriaVinculoGraduando::query()->where('vinculo_id', $nuevoId)->where('accion', 'anulado')->count());
        $this->postJson($this->ruta(), [
            'graduando_id' => $graduando->id,
            'cuenta_id' => $correcta->id,
        ])->assertConflict();
        $this->actingAs($primera, 'web');
        $this->getJson('/api/registros/'.$registros[0])->assertNotFound();
        $this->getJson('/api/mi-institucion')->assertForbidden();
        $this->assertSame($antes, Registro::query()->orderBy('id')->get()->map->getRawOriginal()->all());
    }

    private function ruta(): string
    {
        return '/api/administracion/vinculos-graduandos';
    }

    private function usuario(string ...$roles): User
    {
        $actor = User::factory()->create(['name' => 'Persona ficticia', 'email' => Str::uuid().'@example.invalid']);
        $actor->roles()->attach(Rol::query()->whereIn('codigo', $roles)->pluck('id'));

        return $actor->refresh();
    }

    private function cuentaGraduando(string $nombre = 'Graduando ficticio'): User
    {
        $cuenta = $this->usuario('graduando');
        $cuenta->forceFill(['name' => $nombre])->save();

        return $cuenta->refresh();
    }

    private function eventoConDosCeremonias(): Evento
    {
        $institucion = Institucion::query()->create(['nombre' => 'Institución ficticia', 'tipo' => 'universidad']);

        return app(ProgramarEvento::class)->ejecutar($this->administrador, [
            'institucion_id' => $institucion->id,
            'sede_id' => $institucion->sedes()->create(['nombre' => 'Sede QA'])->id,
            'fecha' => '2099-03-01',
            'numero_ceremonias' => 2,
            'operation_id' => (string) Str::uuid(),
        ]);
    }

    private function ceremonia(): Ceremonia
    {
        $institucion = Institucion::query()->create(['nombre' => 'Institución ficticia', 'tipo' => 'universidad']);

        return app(ProgramarEvento::class)->ejecutar($this->administrador, [
            'institucion_id' => $institucion->id,
            'sede_id' => $institucion->sedes()->create(['nombre' => 'Sede QA'])->id,
            'fecha' => '2099-02-25',
            'numero_ceremonias' => 1,
            'operation_id' => (string) Str::uuid(),
        ])->ceremonias()->sole();
    }
}
