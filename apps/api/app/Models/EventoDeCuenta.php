<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['actor_id', 'cuenta_id', 'accion'])]
class EventoDeCuenta extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'eventos_de_cuenta';
}
