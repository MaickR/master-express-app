<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class SaludTest extends TestCase
{
    public function test_salud_responde_sin_acceder_a_una_base_de_datos(): void
    {
        $this->assertTrue(app()->environment('testing'));
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertEmpty(config('database.connections.sqlite.url'));

        $this->get('/api/salud')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/json')
            ->assertExactJson(['estado' => 'correcto', 'servicio' => 'masterexpress-api']);
    }

    public function test_ruta_api_inexistente_responde_en_json_sin_detalles_internos(): void
    {
        $this->get('/api/inexistente')
            ->assertNotFound()
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonStructure(['message'])
            ->assertJsonMissingPath('exception')
            ->assertJsonMissingPath('file')
            ->assertJsonMissingPath('trace');
    }

    public function test_error_interno_de_api_omite_detalles_de_la_excepcion(): void
    {
        Exceptions::fake();

        Route::get('/api/fallo-qa', function (): never {
            throw new RuntimeException('Detalle interno ficticio');
        });

        $this->get('/api/fallo-qa')
            ->assertInternalServerError()
            ->assertHeader('Content-Type', 'application/json')
            ->assertExactJson(['message' => 'Server Error']);
    }

    public function test_salud_no_autoriza_solicitudes_de_origen_cruzado(): void
    {
        $this->get('/api/salud', ['Origin' => 'https://sitio-externo.example'])
            ->assertOk()
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
