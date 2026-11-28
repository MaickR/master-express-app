<?php

namespace Tests\MySql;

use App\Actions\CorreoInterno;
use App\Models\EventoDeCuenta;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Console\Tester\CommandTester;

class AdminCoreTest extends CasoMySql
{
    protected array $tablas = ['users', 'roles', 'rol_user', 'sessions', 'password_reset_tokens', 'eventos_de_cuenta'];

    private User $principal;

    private string $clave;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(random_bytes(32)), 'session.connection' => 'mysql_pruebas']);
        User::query()->where('principal', true)->update(['principal' => null]);
        $this->clave = bin2hex(random_bytes(18));
        $this->principal = $this->cuenta('administrador');
        $this->principal->forceFill(['principal' => true, 'name' => 'Ernesto'])->saveOrFail();
        $this->autenticar($this->principal, 'web');
        $this->withHeaders(['Origin' => 'http://127.0.0.1:5188', 'Referer' => 'http://127.0.0.1:5188/']);
        config(['sanctum.stateful' => ['127.0.0.1:5188']]);
        Queue::fake();
    }

    public function test_perfil_persiste_sin_cambiar_id_roles_correo_clave_ni_historial(): void
    {
        $id = $this->principal->id;
        $hash = $this->principal->password;
        $correo = $this->principal->email;
        $this->postJson('/api/mi-perfil', ['nombre' => 'Ernesto QA'])->assertNoContent();
        $this->autenticar($this->principal->fresh(), 'web');
        $this->getJson('/api/mi-perfil')->assertOk()->assertJsonPath('data.nombre', 'Ernesto QA')
            ->assertJsonPath('data.roles', ['administrador'])->assertJsonPath('data.principal', true)
            ->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.version_sesion');
        $actual = $this->principal->fresh();
        $this->assertSame($id, $actual->id);
        $this->assertSame($hash, $actual->password);
        $this->assertSame($correo, $actual->email);
        $this->assertDatabaseHas('eventos_de_cuenta', ['cuenta_id' => $id, 'accion' => 'editar-perfil']);
        $this->postJson('/api/mi-perfil', ['nombre' => 'Intruso', 'roles' => ['administrador']])->assertUnprocessable();
        $this->postJson('/api/mi-perfil', ['nombre' => 'Intruso', 'email' => 'otro@example.invalid'])->assertUnprocessable();
    }

    public function test_principal_protegido_aun_con_segundo_administrador_y_correo_distinto(): void
    {
        $segundo = $this->cuenta('administrador');
        $this->autenticar($segundo, 'web');
        foreach (['suspender', 'reactivar', 'revocar-sesiones', 'recuperar', 'restablecer-clave'] as $accion) {
            $this->postJson($this->ruta($this->principal), ['accion' => $accion])->assertForbidden();
        }
        $this->postJson($this->ruta($this->principal), ['accion' => 'cambiar-rol', 'rol' => 'colaborador'])->assertForbidden();
        $this->assertTrue($this->principal->fresh()->activa);
        $this->autenticar($this->principal, 'web');
        $this->postJson($this->ruta($this->principal), ['accion' => 'suspender'])->assertConflict();
        $this->postJson($this->ruta($this->principal), ['accion' => 'cambiar-rol', 'rol' => 'colaborador'])->assertConflict();
        Queue::assertNothingPushed();
    }

    public function test_segundo_admin_crea_colaborador_y_no_sobrescribe_duplicado(): void
    {
        $this->autenticar($this->cuenta('administrador'), 'web');
        $entrada = ['nombre' => '  María José EnsayoPhp Pérez Gómez ', 'correo' => '  MARIA.PEREZ@GMAIL.COM  ', 'rol' => 'colaborador'];
        $alta = $this->postJson('/api/administracion/cuentas', $entrada)->assertCreated()
            ->assertJsonPath('data.correo', 'maria.perez@gmail.com');
        $cuenta = User::findOrFail($alta->json('data.id'));
        $this->assertSame(['colaborador'], $cuenta->codigosDeAcceso());
        $this->assertNull($cuenta->email_verified_at);
        $this->assertNotSame('', $cuenta->password);
        $this->assertSame('bcrypt', Hash::info($cuenta->password)['algoName']);
        $this->postJson('/api/administracion/cuentas', $entrada)->assertUnprocessable();
        $this->assertSame(1, User::where('email', $cuenta->email)->count());
        $this->getJson('/api/administracion/cuentas')->assertOk()->assertJsonMissingPath('data.0.password');
        $this->assertDatabaseHas('eventos_de_cuenta', ['cuenta_id' => $cuenta->id, 'accion' => 'crear-colaborador']);
    }

    public function test_temporal_bloquea_operaciones_y_exige_clave_distinta(): void
    {
        $clave = Str::random(24);
        $alta = $this->postJson('/api/administracion/cuentas', [
            'nombre' => 'Persona Temporal', 'correo' => 'persona@outlook.com', 'rol' => 'administrador', 'password' => $clave,
        ])->assertCreated()->assertJsonMissingPath('data.password_temporal');
        $cuenta = User::findOrFail($alta->json('data.id'));
        $this->assertTrue($cuenta->cambio_clave_pendiente);
        $this->assertTrue(Hash::check($clave, $cuenta->password));

        $this->autenticar($cuenta, 'web');
        $this->getJson('/api/mi-sesion')->assertOk()->assertJsonPath('data.cambio_clave_pendiente', true);
        $this->getJson('/api/administracion/cuentas')->assertForbidden();
        $this->getJson('/api/mi-perfil')->assertForbidden();
        $this->postJson('/api/mi-perfil/contrasena', [
            'current_password' => $clave, 'password' => $clave, 'password_confirmation' => $clave,
        ])->assertUnprocessable();
        $definitiva = Str::random(24);
        $this->postJson('/api/mi-perfil/contrasena', [
            'current_password' => $clave, 'password' => $definitiva, 'password_confirmation' => $definitiva,
        ])->assertNoContent();
        $cuenta->refresh();
        $this->assertFalse($cuenta->cambio_clave_pendiente);
        $this->assertTrue(Hash::check($definitiva, $cuenta->password));
        $this->assertFalse(Hash::check($clave, $cuenta->password));
    }

    public function test_filtros_paginados_edicion_y_restablecimiento_sin_exponer_claves(): void
    {
        for ($indice = 0; $indice < 26; $indice++) {
            $cuenta = $this->cuenta('colaborador');
            $cuenta->forceFill(['name' => 'Grupo filtrado '.$indice, 'created_at' => '2026-10-12 12:00:00'])->saveOrFail();
        }
        $ruta = '/api/administracion/cuentas?q=Grupo+filtrado&rol=colaborador&estado=activa&acceso=disponible&desde=2026-10-12&hasta=2026-10-12';
        $this->getJson($ruta)->assertOk()->assertJsonCount(25, 'data')->assertJsonPath('hayMas', true);
        $this->getJson($ruta.'&page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('hayMas', false);
        $this->getJson('/api/administracion/cuentas?desde=2026-10-12&hasta=2026-10-11')->assertUnprocessable();
        $this->postJson($this->ruta($cuenta), ['accion' => 'editar', 'nombre' => 'Nombre revisado'])->assertNoContent();
        $this->getJson('/api/administracion/cuentas?q='.urlencode($cuenta->email))->assertOk()->assertJsonPath('data.0.nombre', 'Nombre revisado');
        $this->postJson($this->ruta($cuenta), ['accion' => 'restablecer-clave'])->assertOk()->assertJsonStructure(['data' => ['password_temporal']]);
        $this->assertTrue($cuenta->fresh()->cambio_clave_pendiente);
        $this->postJson($this->ruta($this->principal), ['accion' => 'restablecer-clave'])->assertConflict();
        $this->getJson('/api/administracion/cuentas?q=Nombre+revisado')->assertOk()->assertJsonMissingPath('data.0.password_temporal');
    }

    public static function roles(): array
    {
        return [['administrador', 'admin'], ['colaborador', 'lopez'], ['vendedor', 'vendedor'], ['finanzas', 'finanzas'], ['inventario', 'inventario']];
    }

    #[DataProvider('roles')]
    public function test_catalogo_normalizacion_y_roles_sin_portal(string $rol, string $sufijo): void
    {
        $correo = app(CorreoInterno::class)->generar('Ángela', 'López', $rol);
        $this->assertSame('angela.'.$sufijo.'@masterexpress.app', $correo);
        $respuesta = $this->postJson('/api/administracion/cuentas', ['nombre' => 'Ángela López', 'correo' => 'angela@example.invalid', 'rol' => $rol])->assertCreated();
        $cuenta = User::findOrFail($respuesta->json('data.id'));
        $this->assertSame([$rol], $cuenta->roles()->pluck('codigo')->all());
        if (! in_array($rol, User::ROLES_DE_ACCESO, true)) {
            $this->assertSame([], $cuenta->codigosDeSesion());
            $this->assertTrue($cuenta->puedeRecuperarContrasena());
        }
    }

    public function test_creacion_rechaza_roles_externos_reservados_y_campos_de_escalamiento(): void
    {
        $base = ['nombre' => 'Ana Prueba', 'correo' => 'ana@example.invalid', 'rol' => 'colaborador'];
        foreach (['graduando', 'institucion', 'superadmin'] as $rol) {
            $this->postJson('/api/administracion/cuentas', array_replace($base, ['rol' => $rol]))->assertUnprocessable();
        }
        foreach (['admin', 'root', 'soporte'] as $nombre) {
            $this->postJson('/api/administracion/cuentas', array_replace($base, ['correo' => $nombre.'@example.invalid']))->assertUnprocessable();
        }
        foreach (['principal' => true, 'password' => 'ignorado', 'email' => 'admin@masterexpress.app', 'roles' => ['administrador']] as $campo => $valor) {
            $this->postJson('/api/administracion/cuentas', $base + [$campo => $valor])->assertUnprocessable();
        }
    }

    public function test_suspension_reactivacion_sesiones_y_rol_auditado(): void
    {
        $cuenta = $this->cuenta('colaborador');
        DB::table('sessions')->insert(['id' => Str::random(40), 'user_id' => $cuenta->id, 'payload' => '', 'last_activity' => time()]);
        $this->postJson($this->ruta($cuenta), ['accion' => 'suspender'])->assertNoContent();
        $this->assertFalse($cuenta->fresh()->activa);
        $this->assertDatabaseMissing('sessions', ['user_id' => $cuenta->id]);
        $this->assertSame(1, $cuenta->fresh()->version_sesion);
        $this->postJson($this->ruta($cuenta), ['accion' => 'reactivar'])->assertNoContent();
        $this->assertTrue($cuenta->fresh()->activa);
        $this->postJson($this->ruta($cuenta), ['accion' => 'cambiar-rol', 'rol' => 'finanzas'])->assertNoContent();
        $this->assertSame(['finanzas'], $cuenta->fresh()->roles()->pluck('codigo')->all());
        $this->assertDatabaseHas('eventos_de_cuenta', ['cuenta_id' => $cuenta->id, 'accion' => 'rol-finanzas']);
    }

    public function test_admin_inicia_recuperacion_y_titular_principal_recupera_sin_perder_identidad(): void
    {
        $cuenta = $this->cuenta('colaborador');
        $this->postJson($this->ruta($cuenta), ['accion' => 'recuperar'])->assertNoContent();
        // * Los trabajos quedan pendientes del commit; la suite usa una transacción exterior.
        $this->assertDatabaseHas('eventos_de_cuenta', ['cuenta_id' => $cuenta->id, 'accion' => 'iniciar-recuperacion']);
        $token = Password::broker()->createToken($this->principal);
        $nueva = bin2hex(random_bytes(18));
        $this->postJson('/reset-password', ['email' => $this->principal->email, 'token' => $token,
            'password' => $nueva, 'password_confirmation' => $nueva])->assertNoContent();
        $this->assertTrue(Hash::check($nueva, $this->principal->fresh()->password));
        $this->assertTrue((bool) $this->principal->fresh()->principal);
        $this->assertSame(['administrador'], $this->principal->fresh()->codigosDeAcceso());
        $this->assertDatabaseHas('eventos_de_cuenta', ['cuenta_id' => $this->principal->id, 'accion' => 'restablecer-contrasena']);
        $this->postJson('/reset-password', ['email' => $this->principal->email, 'token' => $token,
            'password' => $nueva, 'password_confirmation' => $nueva])->assertUnprocessable();
    }

    public function test_contrasena_voluntaria_exige_actual_y_revoca_todas_las_sesiones(): void
    {
        $nueva = bin2hex(random_bytes(18));
        $this->postJson('/api/mi-perfil/contrasena', ['current_password' => 'incorrecta', 'password' => $nueva,
            'password_confirmation' => $nueva])->assertUnprocessable();
        $this->postJson('/api/mi-perfil/contrasena', ['current_password' => $this->clave, 'password' => $nueva,
            'password_confirmation' => $nueva])->assertNoContent();
        $this->assertTrue(Hash::check($nueva, $this->principal->fresh()->password));
        $this->assertSame(1, $this->principal->fresh()->version_sesion);
        $this->assertDatabaseHas('eventos_de_cuenta', ['cuenta_id' => $this->principal->id, 'accion' => 'cambiar-contrasena']);
    }

    public function test_autorizacion_colaborador_externo_y_anonimo(): void
    {
        foreach (['colaborador', 'graduando', 'institucion', 'vendedor'] as $rol) {
            $this->autenticar($this->cuenta($rol), 'web');
            $this->getJson('/api/administracion/cuentas')->assertForbidden();
            $this->getJson('/api/administracion/cuentas/auditoria')->assertForbidden();
            $this->postJson($this->ruta($this->principal), ['accion' => 'suspender'])->assertForbidden();
            $this->postJson('/api/administracion/cuentas', ['nombre' => 'Ana QA', 'correo' => 'ana@example.invalid', 'rol' => 'administrador'])->assertForbidden();
        }
        $this->autenticar($this->principal, 'web');
        $externa = $this->cuenta('graduando');
        $this->postJson($this->ruta($externa), ['accion' => 'suspender'])->assertNotFound();
    }

    public function test_ultimo_admin_y_auditoria_sin_datos_sensibles(): void
    {
        User::query()->whereKeyNot($this->principal->id)->update(['activa' => false]);
        $this->principal->forceFill(['principal' => null])->saveOrFail();
        $this->postJson($this->ruta($this->principal), ['accion' => 'suspender'])->assertConflict();
        $this->postJson($this->ruta($this->principal), ['accion' => 'cambiar-rol', 'rol' => 'vendedor'])->assertConflict();
        EventoDeCuenta::create(['actor_id' => $this->principal->id, 'cuenta_id' => $this->principal->id, 'accion' => 'editar-perfil']);
        $this->getJson('/api/administracion/cuentas/auditoria')->assertOk()->assertJsonPath('data.0.accion', 'editar-perfil')
            ->assertJsonMissingPath('data.0.password')->assertJsonMissingPath('data.0.email');
    }

    private function autenticar(User $cuenta, string $guard = 'web'): void
    {
        // Cada cambio de actor simula una sesión independiente.
        session()->flush();
        $this->actingAs($cuenta, $guard);
    }

    public function test_preparacion_qa_preserva_id_hash_relaciones_y_no_finge_verificacion(): void
    {
        User::where('email', 'admin@masterexpress.app')->whereKeyNot($this->principal->id)->update(['email' => Str::uuid().'@example.invalid']);
        $this->principal->forceFill(['email_verified_at' => now()])->saveOrFail();
        $hash = $this->principal->password;
        $roles = $this->principal->roles()->pluck('roles.id')->all();
        $cantidad = User::count();
        $tester = new CommandTester(
            Artisan::all()['cuentas:principal-qa'],
        );
        $tester->execute(['id' => $this->principal->id], ['interactive' => true]);
        $this->assertSame(0, $tester->getStatusCode());
        $actual = $this->principal->fresh();
        $this->assertSame($cantidad, User::count());
        $this->assertSame($this->principal->id, $actual->id);
        $this->assertSame($hash, $actual->password);
        $this->assertSame($roles, $actual->roles()->pluck('roles.id')->all());
        $this->assertSame('admin@masterexpress.app', $actual->email);
        $this->assertNull($actual->email_verified_at);
        $this->assertDatabaseHas('eventos_de_cuenta', ['cuenta_id' => $actual->id, 'accion' => 'preparar-principal-qa']);
        $this->assertStringNotContainsString($hash, $tester->getDisplay());
    }

    public function test_preparacion_qa_rechaza_colision_y_terminal_no_interactiva(): void
    {
        User::where('email', 'admin@masterexpress.app')->whereKeyNot($this->principal->id)->update(['email' => Str::uuid().'@example.invalid']);
        $otra = $this->cuenta('administrador');
        $otra->email = 'admin@masterexpress.app';
        $otra->saveOrFail();
        $tester = new CommandTester(
            Artisan::all()['cuentas:principal-qa'],
        );
        $tester->execute(['id' => $this->principal->id], ['interactive' => true]);
        $this->assertSame(1, $tester->getStatusCode());
        $this->assertSame($this->principal->email, $this->principal->fresh()->email);
        $this->assertSame($otra->id, User::where('email', 'admin@masterexpress.app')->firstOrFail()->id);
        $tester->execute(['id' => $this->principal->id], ['interactive' => false]);
        $this->assertSame(1, $tester->getStatusCode());
    }

    public function test_anonimo_sin_perfil_cuentas_ni_auditoria(): void
    {
        Auth::guard('web')->forgetUser();
        session()->flush();
        foreach (['/api/mi-perfil', '/api/administracion/cuentas', '/api/administracion/cuentas/auditoria'] as $ruta) {
            $this->getJson($ruta)->assertUnauthorized();
        }
        $this->postJson('/api/administracion/cuentas', ['nombre' => 'Persona Prueba', 'correo' => 'persona@example.invalid', 'rol' => 'administrador'])
            ->assertUnauthorized();
    }

    private function cuenta(string $rol): User
    {
        $cuenta = User::create(['name' => 'Persona sintética', 'email' => Str::uuid().'@example.invalid', 'password' => $this->clave]);
        $cuenta->roles()->attach(Rol::firstOrCreate(['codigo' => $rol])->id);

        return $cuenta->fresh();
    }

    private function ruta(User $cuenta): string
    {
        return '/api/administracion/cuentas/'.$cuenta->id;
    }
}
