<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('instituciones', function (Blueprint $tabla): void {
            $tabla->string('nit', 30)->nullable()->unique();
        });

        Schema::create('sedes', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('institucion_id')->constrained('instituciones')->restrictOnDelete();
            $tabla->string('nombre', 150);
            $tabla->timestamps();
        });

        Schema::create('solicitudes_institucionales', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->string('estado', 16);
            $tabla->string('tipo', 16);
            $tabla->string('razon_social', 200);
            $tabla->string('nit', 30);
            $tabla->string('sede_nombre', 150);
            $tabla->string('representante_nombre', 150);
            $tabla->string('email', 254);
            $tabla->string('telefono', 30);
            $tabla->char('huella_solicitud', 64);
            $tabla->string('reserva_correo', 254)->nullable()->unique();
            $tabla->foreignId('user_id')->nullable()->constrained('users')->restrictOnDelete();
            $tabla->timestamp('correo_verificado_en')->nullable();
            $tabla->boolean('requiere_activacion')->default(false);
            $tabla->foreignId('decidida_por')->nullable()->constrained('users')->restrictOnDelete();
            $tabla->timestamp('decidida_en')->nullable();
            $tabla->string('motivo_rechazo', 500)->nullable();
            $tabla->foreignId('institucion_id')->nullable()->constrained('instituciones')->restrictOnDelete();
            $tabla->foreignId('sede_id')->nullable()->constrained('sedes')->restrictOnDelete();
            $tabla->timestamp('activada_en')->nullable();
            $tabla->string('notificacion_estado', 16)->nullable();
            $tabla->string('notificacion_detalle', 160)->nullable();
            $tabla->timestamps();
            $tabla->index(['estado', 'id']);
            $tabla->index('email');
        });

        Schema::create('vinculos_institucionales', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $tabla->foreignId('institucion_id')->constrained('instituciones')->restrictOnDelete();
            $tabla->foreignId('sede_id')->constrained('sedes')->restrictOnDelete();
            $tabla->foreignId('solicitud_id')->unique()->constrained('solicitudes_institucionales')->restrictOnDelete();
            $tabla->string('estado', 24);
            $tabla->timestamps();
            $tabla->unique(['user_id', 'institucion_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vinculos_institucionales');
        Schema::dropIfExists('solicitudes_institucionales');
        Schema::dropIfExists('sedes');
        Schema::table('instituciones', function (Blueprint $tabla): void {
            $tabla->dropUnique(['nit']);
            $tabla->dropColumn('nit');
        });
    }
};
