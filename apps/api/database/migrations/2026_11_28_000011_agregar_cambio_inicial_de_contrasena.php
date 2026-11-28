<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $tabla) => $tabla->boolean('cambio_clave_pendiente')->default(false));
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $tabla) => $tabla->dropColumn('cambio_clave_pendiente'));
    }
};
