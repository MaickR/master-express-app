<?php

namespace Tests\Feature;

use Tests\TestCase;

class EnsayoEventosTest extends TestCase
{
    public function test_cors_del_ensayo_respeta_el_origen_configurado(): void
    {
        config(['cors.allowed_origins' => ['http://127.0.0.1:5173', 'http://127.0.0.1:8000']]);

        $this->options('/api/eventos', [], [
            'Origin' => 'http://127.0.0.1:5173',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type,x-xsrf-token',
        ])->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');

        $this->getJson('/api/instituciones', ['Origin' => 'http://127.0.0.1:5173'])
            ->assertUnauthorized()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
        $this->getJson('/api/eventos/1/ceremonias', ['Origin' => 'http://127.0.0.1:5173'])
            ->assertUnauthorized()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
        $this->getJson('/api/instituciones', ['Origin' => 'http://127.0.0.1:5174'])
            ->assertUnauthorized()
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_el_comando_rechaza_conexiones_distintas_a_la_base_aislada(): void
    {
        $this->artisan('qa:ensayo-eventos', ['accion' => 'preparar'])
            ->expectsOutput('Use APP_ENV=testing y DB_CONNECTION=mysql_pruebas.')->assertFailed();
        $this->artisan('qa:ensayo-eventos', ['accion' => 'borrar'])
            ->expectsOutput('Indique la acción preparar o cerrar.')->assertFailed();
    }
}
