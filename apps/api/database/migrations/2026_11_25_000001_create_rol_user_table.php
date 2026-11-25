<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rol_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rol_id')->index()->constrained('roles')->restrictOnDelete();
            $table->primary(['user_id', 'rol_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rol_user');
    }
};
