<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SolicitudInstitucional extends Model
{
    public const string PENDIENTE = 'pendiente';

    public const string APROBADA = 'aprobada';

    public const string RECHAZADA = 'rechazada';

    public const string AVISO_PENDIENTE = 'pendiente';

    public const string AVISO_ENVIANDO = 'enviando';

    public const string AVISO_ENVIADA = 'enviada';

    public const string AVISO_FALLIDA = 'fallida';

    public const string FALLO_ENTREGA = 'No se pudo entregar la notificación institucional.';

    public const string FALLO_ENTORNO = 'El correo de la solicitud no admite entrega en este entorno.';

    protected $table = 'solicitudes_institucionales';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'correo_verificado_en' => 'datetime',
            'decidida_en' => 'datetime',
            'activada_en' => 'datetime',
            'requiere_activacion' => 'boolean',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function titular(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return BelongsTo<User, $this> */
    public function responsable(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decidida_por');
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

    /** @return array<string, mixed> */
    public function resumen(): array
    {
        return [
            'id' => $this->id,
            'estado' => $this->estado,
            'tipo' => $this->tipo,
            'razon_social' => $this->razon_social,
            'nit' => $this->nit,
            'sede' => $this->sede_nombre,
            'representante' => $this->representante_nombre,
            'email' => $this->email,
            'telefono' => $this->telefono,
            'cuenta_existente' => $this->user_id !== null && ! $this->requiere_activacion,
            'creada_en' => $this->created_at?->toIso8601String(),
            'notificacion_estado' => $this->notificacion_estado,
        ];
    }

    /** @return array<string, mixed> */
    public function detalle(): array
    {
        return $this->resumen() + [
            'correo_verificado_en' => $this->correo_verificado_en?->toIso8601String(),
            'requiere_activacion' => $this->requiere_activacion,
            'activada_en' => $this->activada_en?->toIso8601String(),
            'institucion_id' => $this->institucion_id,
            'sede_id' => $this->sede_id,
            'decision' => $this->decidida_en === null ? null : [
                'estado' => $this->estado,
                'en' => $this->decidida_en->toIso8601String(),
                'administrador_id' => $this->decidida_por,
                'motivo' => $this->motivo_rechazo,
            ],
            'notificacion' => $this->notificacion_estado === null ? null : [
                'estado' => $this->notificacion_estado,
                'detalle' => $this->notificacion_detalle,
            ],
        ];
    }
}
