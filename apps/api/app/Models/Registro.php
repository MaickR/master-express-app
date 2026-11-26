<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['programa_academico'])]
#[Hidden(['operation_id', 'huella_solicitud'])]
class Registro extends Model
{
    protected $table = 'registros';

    /** @return BelongsTo<Graduando, $this> */
    public function graduando(): BelongsTo
    {
        return $this->belongsTo(Graduando::class);
    }

    /** @return BelongsTo<Ceremonia, $this> */
    public function ceremonia(): BelongsTo
    {
        return $this->belongsTo(Ceremonia::class);
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
