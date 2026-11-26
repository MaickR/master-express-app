<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instituciones', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->string('nombre');
            $tabla->string('tipo', 20);
            $tabla->timestamps();
        });

        Schema::create('eventos', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('institucion_id')->constrained('instituciones')->restrictOnDelete();
            $tabla->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $tabla->uuid('operation_id');
            $tabla->char('huella_solicitud', 64);
            $tabla->date('fecha');
            $tabla->string('lugar')->nullable();
            $tabla->timestamps();
            $tabla->unique(['actor_id', 'operation_id']);
            $tabla->index(['fecha', 'id']);
        });

        Schema::create('ceremonias', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('evento_id')->constrained('eventos')->restrictOnDelete();
            $tabla->string('nombre');
            $tabla->time('hora')->nullable();
            $tabla->unsignedSmallInteger('orden');
            $tabla->timestamps();
            $tabla->unique(['evento_id', 'orden']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ceremonias');
        Schema::dropIfExists('eventos');
        Schema::dropIfExists('instituciones');
    }
};
