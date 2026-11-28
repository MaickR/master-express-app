<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['fecha', 'lugar', 'graduandos_previstos', 'responsable', 'observaciones'])]
#[Hidden(['actor_id', 'operation_id', 'huella_solicitud', 'cancelado_por'])]
class Evento extends Model
{
    protected $table = 'eventos';

    protected $attributes = ['revision' => 1];

    public static function fechaOperativa(): string
    {
        return now('America/Bogota')->toDateString();
    }

    public function estado(string $hoy): string
    {
        if ($this->cancelado_en !== null) {
            return 'cancelado';
        }

        return match ($this->fecha->toDateString() <=> $hoy) {
            -1 => 'finalizado',
            0 => 'en_ejecucion',
            1 => 'proximo',
        };
    }

    /** @return BelongsTo<Institucion, $this> */
    public function institucion(): BelongsTo
    {
        return $this->belongsTo(Institucion::class);
    }

    /** @return BelongsTo<Sede, $this> */
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    /** @return HasMany<Ceremonia, $this> */
    public function ceremonias(): HasMany
    {
        return $this->hasMany(Ceremonia::class)->orderBy('orden');
    }

    protected function casts(): array
    {
        return ['fecha' => 'immutable_date:Y-m-d', 'cancelado_en' => 'immutable_datetime'];
    }
}
