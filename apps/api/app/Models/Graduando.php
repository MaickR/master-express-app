<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nombre_completo'])]
class Graduando extends Model
{
    protected $table = 'graduandos';

    /** @return HasMany<Registro, $this> */
    public function registros(): HasMany
    {
        return $this->hasMany(Registro::class);
    }

    /** @return HasMany<VinculoGraduando, $this> */
    public function vinculos(): HasMany
    {
        return $this->hasMany(VinculoGraduando::class);
    }
}
