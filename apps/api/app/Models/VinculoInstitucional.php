<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VinculoInstitucional extends Model
{
    public const string PENDIENTE = 'pendiente_activacion';

    public const string ACTIVO = 'activo';

    protected $table = 'vinculos_institucionales';

    /** @return BelongsTo<User, $this> */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
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

    /** @return BelongsTo<SolicitudInstitucional, $this> */
    public function solicitud(): BelongsTo
    {
        return $this->belongsTo(SolicitudInstitucional::class, 'solicitud_id');
    }
}
