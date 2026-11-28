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

    public function test_cors_de_programacion_institucional_respeta_el_origen_y_exige_sesion(): void
    {
        $origen = 'http://127.0.0.1:5173';
        $origenAjeno = 'https://otro.example.invalid';
        config(['cors.allowed_origins' => [$origen]]);

        foreach (['/api/mi-institucion/vinculos/1/eventos', '/api/mi-institucion/vinculos/1/eventos/2'] as $ruta) {
            $this->getJson($ruta, ['Origin' => $origen])
                ->assertUnauthorized()
                ->assertHeader('Access-Control-Allow-Origin', $origen);
            $respuestaAjena = $this->getJson($ruta, ['Origin' => $origenAjeno])->assertUnauthorized();
            $this->assertNotSame($origenAjeno, $respuestaAjena->headers->get('Access-Control-Allow-Origin'));
        }
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
            ['api/mi-perfil', ['GET', 'HEAD']],
            ['api/mi-perfil', ['POST']],
            ['api/mi-perfil/contrasena', ['POST']],
            ['api/mi-institucion', ['GET', 'HEAD']],
            ['api/mi-institucion/vinculos/{vinculo}/eventos', ['GET', 'HEAD']],
            ['api/mi-institucion/vinculos/{vinculo}/eventos/{evento}', ['GET', 'HEAD']],
            ['api/registro-graduando/codigo', ['POST']],
            ['api/registro-graduando/confirmacion', ['POST']],
            ['api/registro-graduando/cuenta', ['POST']],
            ['api/registro-institucion/codigo', ['POST']],
            ['api/registro-institucion/confirmacion', ['POST']],
            ['api/registro-institucion/solicitud', ['POST']],
            ['api/registro-institucion/representacion', ['POST']],
            ['api/registro-institucion/activacion', ['POST']],
            ['api/administracion/solicitudes-institucionales', ['GET', 'HEAD']],
            ['api/administracion/solicitudes-institucionales/decisiones', ['GET', 'HEAD']],
            ['api/administracion/solicitudes-institucionales/{solicitud}', ['GET', 'HEAD']],
            ['api/administracion/solicitudes-institucionales/{solicitud}/aprobacion', ['POST']],
            ['api/administracion/solicitudes-institucionales/{solicitud}/rechazo', ['POST']],
            ['api/administracion/solicitudes-institucionales/{solicitud}/notificacion', ['POST']],
            ['api/registros', ['GET', 'HEAD']],
            ['api/registros/{registro}', ['GET', 'HEAD']],
            ['api/ceremonias/{ceremonia}/registros', ['POST']],
            ['api/administracion/cuentas', ['GET', 'HEAD']],
            ['api/administracion/cuentas', ['POST']],
            ['api/administracion/cuentas/auditoria', ['GET', 'HEAD']],
            ['api/administracion/cuentas/{cuenta}', ['POST']],
            ['api/administracion/vinculos-graduandos/graduandos', ['GET', 'HEAD']],
            ['api/administracion/vinculos-graduandos/cuentas', ['GET', 'HEAD']],
            ['api/administracion/vinculos-graduandos', ['POST']],
            ['api/administracion/vinculos-graduandos/{vinculo}/anulacion', ['POST']],
            ['api/administracion/vinculos-graduandos/{vinculo}/correccion', ['POST']],
            ['api/instituciones', ['GET', 'HEAD']],
            ['api/eventos', ['GET', 'HEAD']],
            ['api/eventos', ['POST']],
            ['api/eventos/{evento}', ['GET', 'HEAD']],
            ['api/eventos/{evento}', ['POST']],
            ['api/eventos/{evento}/cancelacion', ['POST']],
            ['api/eventos/{evento}/ceremonias', ['GET', 'HEAD']],
            ['api/eventos/{evento}/ceremonias/{ceremonia}', ['GET', 'HEAD']],
            ['api/graduandos/programacion', ['GET', 'HEAD']],
            ['api/graduandos/filtros', ['GET', 'HEAD']],
            ['api/graduandos', ['GET', 'HEAD']],
            ['api/graduandos', ['POST']],
            ['api/graduandos/{graduando}', ['GET', 'HEAD']],
            ['api/graduandos/{graduando}', ['POST']],
            ['sanctum/csrf-cookie', ['GET', 'HEAD']],
            ['login', ['POST']],
            ['logout', ['POST']],
            ['forgot-password', ['POST']],
            ['reset-password', ['POST']],
        ], $rutasApi);

        $this->postJson('/register')->assertNotFound();
    }
}
