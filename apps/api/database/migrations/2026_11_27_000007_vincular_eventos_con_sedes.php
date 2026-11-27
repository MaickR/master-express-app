<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sedes', function (Blueprint $tabla): void {
            $tabla->unique(['institucion_id', 'id']);
        });

        Schema::table('eventos', function (Blueprint $tabla): void {
            $tabla->foreignId('sede_id')->nullable();
            $tabla->index(['institucion_id', 'sede_id', 'fecha', 'id'], 'eventos_ambito_fecha_index');
            $tabla->foreign(['institucion_id', 'sede_id'])->references(['institucion_id', 'id'])
                ->on('sedes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        // * MySQL puede sustituir los índices implícitos de las FK institucionales por los nuevos índices.
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            foreach (['eventos', 'sedes'] as $nombreTabla) {
                if (! Schema::hasIndex($nombreTabla, ['institucion_id'])) {
                    Schema::table($nombreTabla, fn (Blueprint $tabla) => $tabla->index('institucion_id'));
                }
            }
        }

        Schema::table('eventos', function (Blueprint $tabla): void {
            $tabla->dropForeign(['institucion_id', 'sede_id']);
            $tabla->dropIndex('eventos_ambito_fecha_index');
            $tabla->dropColumn('sede_id');
        });

        Schema::table('sedes', function (Blueprint $tabla): void {
            $tabla->dropUnique(['institucion_id', 'id']);
        });
    }
};
