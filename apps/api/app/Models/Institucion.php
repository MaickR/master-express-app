<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nombre', 'tipo'])]
class Institucion extends Model
{
    protected $table = 'instituciones';

    /** @return HasMany<Evento, $this> */
    public function eventos(): HasMany
    {
        return $this->hasMany(Evento::class);
    }

    /** @return HasMany<Sede, $this> */
    public function sedes(): HasMany
    {
        return $this->hasMany(Sede::class);
    }
}
