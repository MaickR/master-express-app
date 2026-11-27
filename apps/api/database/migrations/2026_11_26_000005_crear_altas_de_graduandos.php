<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $tabla): void {
            $tabla->string('name', 301)->change();
            $tabla->string('nombres', 150)->nullable();
            $tabla->string('apellidos', 150)->nullable();
            $tabla->string('telefono', 30)->nullable();
            $tabla->string('tipo_documento', 24)->nullable();
            $tabla->string('numero_documento', 32)->nullable();
        });

        Schema::create('desafios_de_registro', function (Blueprint $tabla): void {
            $tabla->char('clave', 64)->primary();
            $tabla->char('contexto', 64);
            $tabla->uuid('emision');
            $tabla->char('codigo_hmac', 64)->nullable();
            $tabla->unsignedTinyInteger('intentos')->default(0);
            $tabla->unsignedBigInteger('reenviar_desde');
            $tabla->unsignedBigInteger('vence_en')->index();
            $tabla->string('estado', 12);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('desafios_de_registro');
        Schema::table('users', function (Blueprint $tabla): void {
            $tabla->dropColumn(['nombres', 'apellidos', 'telefono', 'tipo_documento', 'numero_documento']);
        });
    }
};
