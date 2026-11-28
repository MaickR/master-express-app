<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nombre', 'hora', 'orden'])]
class Ceremonia extends Model
{
    protected $table = 'ceremonias';

    /** @return BelongsTo<Evento, $this> */
    public function evento(): BelongsTo
    {
        return $this->belongsTo(Evento::class);
    }

    /** @return HasMany<Registro, $this> */
    public function registros(): HasMany
    {
        return $this->hasMany(Registro::class);
    }
}
