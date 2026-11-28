<?php

namespace App\Http\Requests;

use App\Models\Evento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ActualizarEvento extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', Evento::class);

        return true;
    }

    public function validationData(): array
    {
        return ['evento' => $this->isJson() ? $this->json()->all() : $this->request->all()];
    }

    public function rules(): array
    {
        return [
            'evento' => ['required', 'array:revision,fecha,lugar,graduandos_previstos,responsable,observaciones,ceremonias'],
            'evento.revision' => ['required', 'integer', 'min:1'],
            'evento.fecha' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'evento.lugar' => ['nullable', 'string', 'max:255'],
            'evento.graduandos_previstos' => ['nullable', 'integer', 'between:0,4294967295'],
            'evento.responsable' => ['nullable', 'string', 'max:120'],
            'evento.observaciones' => ['nullable', 'string', 'max:2000'],
            'evento.ceremonias' => ['sometimes', 'array', 'list', 'max:6'],
            'evento.ceremonias.*' => ['array:id,nombre,hora'],
            'evento.ceremonias.*.id' => ['required', 'integer', 'min:1', 'distinct'],
            'evento.ceremonias.*.nombre' => ['required', 'string', 'max:255'],
            'evento.ceremonias.*.hora' => ['present', 'nullable', 'date_format:H:i'],
        ];
    }
}
