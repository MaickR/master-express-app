<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('graduandos', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->string('nombre_completo');
            $tabla->timestamps();
        });

        Schema::create('registros', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('graduando_id')->constrained('graduandos')->restrictOnDelete();
            $tabla->foreignId('ceremonia_id')->constrained('ceremonias')->restrictOnDelete();
            $tabla->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $tabla->uuid('operation_id');
            $tabla->char('huella_solicitud', 64);
            $tabla->string('programa_academico')->nullable();
            $tabla->timestamps();

            $tabla->unique(['graduando_id', 'ceremonia_id']);
            $tabla->unique(['actor_id', 'operation_id']);
            $tabla->index(['ceremonia_id', 'id']);
            $tabla->index(['actor_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registros');
        Schema::dropIfExists('graduandos');
    }
};
