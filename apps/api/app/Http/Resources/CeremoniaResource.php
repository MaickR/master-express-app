<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CeremoniaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'evento_id' => $this->evento_id,
            'nombre' => $this->nombre,
            'hora' => $this->hora,
            'orden' => $this->orden,
        ];
    }
}
