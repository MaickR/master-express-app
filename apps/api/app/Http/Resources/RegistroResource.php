<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RegistroResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'graduando' => [
                'id' => $this->graduando->id,
                'nombre_completo' => $this->graduando->nombre_completo,
            ],
            'evento_id' => $this->ceremonia->evento_id,
            'ceremonia_id' => $this->ceremonia_id,
            'programa_academico' => $this->programa_academico,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
