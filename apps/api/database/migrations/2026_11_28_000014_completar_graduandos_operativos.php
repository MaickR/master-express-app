<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('graduandos', function (Blueprint $tabla): void {
            $tabla->string('tipo_documento', 2)->nullable();
            $tabla->string('numero_documento', 30)->nullable();
            $tabla->string('correo', 254)->nullable();
            $tabla->string('telefono', 15)->nullable();
            $tabla->foreignId('creado_por')->nullable()->constrained('users')->restrictOnDelete();
            $tabla->uuid('operation_id')->nullable();
            $tabla->char('huella_solicitud', 64)->nullable();
            $tabla->unsignedInteger('revision')->default(1);
            $tabla->unique(['tipo_documento', 'numero_documento'], 'graduandos_documento_unico');
            $tabla->unique(['creado_por', 'operation_id'], 'graduandos_operacion_unica');
        });
    }

    public function down(): void
    {
        Schema::table('graduandos', function (Blueprint $tabla): void {
            $tabla->dropUnique('graduandos_documento_unico');
            $tabla->dropUnique('graduandos_operacion_unica');
            $tabla->dropForeign(['creado_por']);
            $tabla->dropColumn(['tipo_documento', 'numero_documento', 'correo', 'telefono', 'creado_por', 'operation_id', 'huella_solicitud', 'revision']);
        });
    }
};
