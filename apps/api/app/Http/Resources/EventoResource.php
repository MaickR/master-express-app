<?php

namespace App\Http\Resources;

use App\Models\Evento;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'institucion' => InstitucionResource::make($this->institucion),
            'sede' => $this->whenLoaded('sede', fn (): array => [
                'id' => $this->sede->id,
                'nombre' => $this->sede->nombre,
            ]),
            'fecha' => $this->fecha->toDateString(),
            'estado' => $this->resource->estado($request->attributes->get('fecha_operativa') ?? Evento::fechaOperativa()),
            'lugar' => $this->lugar,
            'numero_ceremonias' => $this->ceremonias_count,
            'ceremonias' => CeremoniaResource::collection($this->whenLoaded('ceremonias')),
            $this->mergeWhen($request->routeIs('eventos.show', 'eventos.store', 'eventos.update', 'eventos.cancelar'), fn (): array => [
                'revision' => $this->revision,
                'graduandos_previstos' => $this->graduandos_previstos,
                'responsable' => $this->responsable,
                'observaciones' => $this->observaciones,
                'cancelado_en' => $this->cancelado_en?->toISOString(),
            ]),
        ];
    }
}
