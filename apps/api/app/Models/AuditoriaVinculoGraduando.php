<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditoriaVinculoGraduando extends Model
{
    public const string CONFIRMADO = 'confirmado';

    public const string ANULADO = 'anulado';

    public $timestamps = false;

    protected $table = 'auditoria_vinculos_graduandos';

    protected $guarded = ['*'];

    /** @return BelongsTo<VinculoGraduando, $this> */
    public function vinculo(): BelongsTo
    {
        return $this->belongsTo(VinculoGraduando::class, 'vinculo_id');
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
