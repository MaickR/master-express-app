<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VinculoGraduando extends Model
{
    public const string ACTIVO = 'activo';

    public const string ANULADO = 'anulado';

    protected $table = 'vinculos_de_graduandos';

    protected $guarded = ['*'];

    /** @return BelongsTo<User, $this> */
    public function cuenta(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return BelongsTo<Graduando, $this> */
    public function graduando(): BelongsTo
    {
        return $this->belongsTo(Graduando::class);
    }

    /** @return BelongsTo<User, $this> */
    public function administrador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decidido_por');
    }

    /** @return BelongsTo<User, $this> */
    public function anulador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'anulado_por');
    }

    /** @return HasMany<AuditoriaVinculoGraduando, $this> */
    public function auditorias(): HasMany
    {
        return $this->hasMany(AuditoriaVinculoGraduando::class, 'vinculo_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decidida_en' => 'datetime',
            'anulado_en' => 'datetime',
        ];
    }
}
