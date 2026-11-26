<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class IdentidadSinExposicionTest extends TestCase
{
    public function test_los_roles_no_son_asignables_desde_atributos_del_usuario(): void
    {
        $claveFicticia = 'Clave-ficticia-solo-QA';
        $usuario = new User(['name' => 'Persona de prueba', 'password' => $claveFicticia, 'roles' => ['administrador']]);

        $this->assertFalse($usuario->isFillable('roles'));
        $this->assertFalse($usuario->isFillable('activa'));
        $this->assertFalse($usuario->isFillable('version_sesion'));
        $this->assertArrayNotHasKey('roles', $usuario->getAttributes());
        $this->assertTrue(Hash::check($claveFicticia, $usuario->password));
        $this->assertArrayNotHasKey('password', $usuario->toArray());
    }

    public function test_solo_se_exponen_las_rutas_aprobadas_de_la_api_y_autenticacion(): void
    {
        $rutasApi = collect(app('router')->getRoutes()->getRoutes())
            ->reject(fn ($ruta) => str_starts_with($ruta->uri(), 'storage/'))
            ->map(fn ($ruta) => [$ruta->uri(), $ruta->methods()])
            ->values()
            ->all();

        $this->assertEqualsCanonicalizing([
            ['api/salud', ['GET', 'HEAD']],
            ['api/mi-sesion', ['GET', 'HEAD']],
            ['api/administracion/cuentas', ['GET', 'HEAD']],
            ['api/administracion/cuentas/{cuenta}', ['POST']],
            ['sanctum/csrf-cookie', ['GET', 'HEAD']],
            ['login', ['POST']],
            ['logout', ['POST']],
            ['forgot-password', ['POST']],
            ['reset-password', ['POST']],
        ], $rutasApi);

        $this->postJson('/register')->assertNotFound();
    }
}
