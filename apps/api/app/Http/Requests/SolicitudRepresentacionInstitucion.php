<?php

namespace App\Http\Requests;

use Illuminate\Validation\Validator;

class SolicitudRepresentacionInstitucion extends SolicitudRegistroInstitucion
{
    protected function prepareForValidation(): void
    {
        if (! $this->isJson()) {
            return;
        }
        $ajustes = [];
        foreach (['razon_social', 'nit', 'sede', 'representante', 'telefono', 'tipo'] as $campo) {
            if (is_string($valor = $this->json($campo))) {
                $ajustes[$campo] = trim($valor);
            }
        }
        if ($ajustes !== []) {
            $this->merge($ajustes);
        }
    }

    public function rules(): array
    {
        return $this->datosInstitucionales();
    }

    public function after(): array
    {
        return [
            function (Validator $validador): void {
                if (array_diff_key($validador->getData(), $validador->getRules()) !== []) {
                    $validador->errors()->add('solicitud', 'La solicitud contiene campos no admitidos.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return $this->mensajesInstitucionales();
    }
}
