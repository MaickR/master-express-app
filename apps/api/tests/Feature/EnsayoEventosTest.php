<?php

namespace Tests\Feature;

use Tests\TestCase;

class EnsayoEventosTest extends TestCase
{
    public function test_el_comando_rechaza_conexiones_distintas_a_la_base_aislada(): void
    {
        $this->artisan('qa:ensayo-eventos', ['accion' => 'preparar'])
            ->expectsOutput('Use APP_ENV=testing y DB_CONNECTION=mysql_pruebas.')->assertFailed();
        $this->artisan('qa:ensayo-eventos', ['accion' => 'borrar'])
            ->expectsOutput('Indique la acción preparar o cerrar.')->assertFailed();
    }
}
