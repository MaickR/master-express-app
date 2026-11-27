<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class SolicitudRegistroInstitucion extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (! $this->isJson()) {
            return;
        }
        $ajustes = [];
        if (is_string($correo = $this->json('email'))) {
            $ajustes['email'] = Str::lower(trim($correo));
        }
        foreach (['razon_social', 'nit', 'sede', 'representante', 'telefono', 'tipo'] as $campo) {
            if (is_string($valor = $this->json($campo))) {
                $ajustes[$campo] = trim($valor);
            }
        }
        if ($ajustes !== []) {
            $this->merge($ajustes);
        }
    }

    public function validationData(): array
    {
        return $this->isJson() ? $this->json()->all() : [];
    }

    public function rules(): array
    {
        $reglas = ['email' => ReglasDeContacto::correo()];
        if ($this->routeIs('registro-institucion.confirmar')) {
            $reglas['codigo'] = ['bail', 'required', 'string', 'regex:/\A[0-9]{6}\z/'];
        }
        if ($this->routeIs('registro-institucion.crear')) {
            $reglas += $this->datosInstitucionales();
        }

        return $reglas;
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
        return $this->mensajesInstitucionales() + [
            'email.*' => 'Ingresa un correo electrónico válido.',
            'codigo.*' => 'Ingresa un código de seis dígitos.',
        ];
    }

    /** @return array<string, mixed> */
    protected function datosInstitucionales(): array
    {
        return [
            'tipo' => ['bail', 'required', 'string', 'in:colegio,universidad'],
            'razon_social' => ReglasDeContacto::textoInstitucional(200),
            'nit' => ReglasDeContacto::nit(),
            'sede' => ReglasDeContacto::textoInstitucional(150),
            'representante' => ReglasDeContacto::nombre(),
            'telefono' => ReglasDeContacto::telefono(),
        ];
    }

    /** @return array<string, string> */
    protected function mensajesInstitucionales(): array
    {
        return [
            'tipo.*' => 'Selecciona Colegio o Universidad.',
            'razon_social.*' => 'Ingresa la razón social (hasta 200 caracteres).',
            'nit.*' => 'Ingresa el NIT con dígitos. Si usas un guion, debe separar dos grupos.',
            'sede.*' => 'Ingresa la sede (hasta 150 caracteres).',
            'representante.*' => 'Ingresa el nombre completo con letras y signos propios del nombre (hasta 150 caracteres).',
            'telefono.*' => 'Ingresa entre 7 y 15 dígitos. Puedes incluir el indicativo.',
        ];
    }
}
