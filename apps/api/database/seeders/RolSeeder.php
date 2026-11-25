<?php

namespace Database\Seeders;

use App\Models\Rol;
use Illuminate\Database\Seeder;

class RolSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['administrador', 'colaborador', 'vendedor', 'finanzas', 'inventario', 'graduando', 'institucion'] as $codigo) {
            Rol::query()->firstOrCreate(['codigo' => $codigo]);
        }
    }
}
