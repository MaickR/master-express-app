<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('eventos', function (Blueprint $tabla): void {
            $tabla->timestamp('cancelado_en')->nullable();
            $tabla->foreignId('cancelado_por')->nullable()->constrained('users')->restrictOnDelete();
            $tabla->unsignedInteger('graduandos_previstos')->nullable();
            $tabla->string('responsable', 120)->nullable();
            $tabla->text('observaciones')->nullable();
            $tabla->unsignedInteger('revision')->default(1);
        });
    }

    public function down(): void
    {
        Schema::table('eventos', function (Blueprint $tabla): void {
            $tabla->dropConstrainedForeignId('cancelado_por');
            $tabla->dropColumn(['cancelado_en', 'graduandos_previstos', 'responsable', 'observaciones', 'revision']);
        });
    }
};
