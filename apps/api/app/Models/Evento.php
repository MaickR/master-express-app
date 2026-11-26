<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['fecha', 'lugar'])]
#[Hidden(['actor_id', 'operation_id', 'huella_solicitud'])]
class Evento extends Model
{
    protected $table = 'eventos';

    /** @return BelongsTo<Institucion, $this> */
    public function institucion(): BelongsTo
    {
        return $this->belongsTo(Institucion::class);
    }

    /** @return HasMany<Ceremonia, $this> */
    public function ceremonias(): HasMany
    {
        return $this->hasMany(Ceremonia::class)->orderBy('orden');
    }

    protected function casts(): array
    {
        return ['fecha' => 'immutable_date:Y-m-d'];
    }
}
