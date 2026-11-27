<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vinculos_de_graduandos', function (Blueprint $tabla): void {
            $tabla->string('motivo_anulacion', 500)->nullable();
            $tabla->foreignId('anulado_por')->nullable()->constrained('users')->restrictOnDelete();
            $tabla->timestamp('anulado_en')->nullable();
        });

        Schema::create('auditoria_vinculos_graduandos', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('vinculo_id')->constrained('vinculos_de_graduandos')->restrictOnDelete();
            $tabla->string('accion', 16);
            $tabla->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $tabla->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $tabla->foreignId('graduando_id')->constrained('graduandos')->restrictOnDelete();
            $tabla->string('motivo', 500)->nullable();
            $tabla->timestamp('created_at');
            $tabla->index(['vinculo_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auditoria_vinculos_graduandos');
        Schema::table('vinculos_de_graduandos', function (Blueprint $tabla): void {
            $tabla->dropConstrainedForeignId('anulado_por');
            $tabla->dropColumn(['motivo_anulacion', 'anulado_en']);
        });
    }
};
