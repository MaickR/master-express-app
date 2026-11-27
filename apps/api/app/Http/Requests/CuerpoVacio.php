<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CuerpoVacio extends FormRequest
{
    public function validationData(): array
    {
        return $this->isJson() ? $this->json()->all() : ($this->request->count() > 0 ? $this->request->all() : []);
    }

    public function rules(): array
    {
        return [];
    }

    public function after(): array
    {
        return [
            function (Validator $validador): void {
                if ($validador->getData() !== []) {
                    $validador->errors()->add('solicitud', 'La solicitud contiene campos no admitidos.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return ['solicitud.*' => 'La solicitud contiene campos no admitidos.'];
    }
}
