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
        $this->assertArrayNotHasKey('roles', $usuario->getAttributes());
        $this->assertTrue(Hash::check($claveFicticia, $usuario->password));
        $this->assertArrayNotHasKey('password', $usuario->toArray());
    }

    public function test_api_no_expone_rutas_de_identidad_en_esta_etapa(): void
    {
        $rutasApi = collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn ($ruta) => str_starts_with($ruta->uri(), 'api/'))
            ->map(fn ($ruta) => [$ruta->uri(), $ruta->methods()])
            ->values()
            ->all();

        $this->assertSame([['api/salud', ['GET', 'HEAD']]], $rutasApi);
    }
}
