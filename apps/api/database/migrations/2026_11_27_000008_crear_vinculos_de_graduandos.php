<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vinculos_de_graduandos', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $tabla->foreignId('graduando_id')->constrained('graduandos')->restrictOnDelete();
            $tabla->foreignId('decidido_por')->constrained('users')->restrictOnDelete();
            $tabla->timestamp('decidida_en');
            $tabla->string('estado', 16);
            $tabla->timestamps();
            // * Impide repetir el mismo par. La cardinalidad entre cuentas y graduandos distintos sigue abierta.
            $tabla->unique(['user_id', 'graduando_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vinculos_de_graduandos');
    }
};
