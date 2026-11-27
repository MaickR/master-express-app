<?php

namespace App\Http\Resources;

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
            'lugar' => $this->lugar,
            'numero_ceremonias' => $this->ceremonias_count,
            'ceremonias' => CeremoniaResource::collection($this->whenLoaded('ceremonias')),
        ];
    }
}
