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
            'fecha' => $this->fecha->toDateString(),
            'lugar' => $this->lugar,
            'numero_ceremonias' => $this->ceremonias_count,
            'ceremonias' => CeremoniaResource::collection($this->whenLoaded('ceremonias')),
        ];
    }
}
