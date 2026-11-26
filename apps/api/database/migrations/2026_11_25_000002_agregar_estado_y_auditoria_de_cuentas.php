<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $tabla): void {
            $tabla->boolean('activa')->default(true);
            $tabla->unsignedInteger('version_sesion')->default(0);
        });

        Schema::create('eventos_de_cuenta', function (Blueprint $tabla): void {
            $tabla->id();
            $tabla->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $tabla->foreignId('cuenta_id')->constrained('users')->restrictOnDelete();
            $tabla->string('accion', 24);
            $tabla->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('eventos_de_cuenta');

        Schema::table('users', function (Blueprint $tabla): void {
            $tabla->dropColumn(['activa', 'version_sesion']);
        });
    }
};
