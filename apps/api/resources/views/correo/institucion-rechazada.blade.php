@extends('correo.base', ['titulo' => 'Tu solicitud institucional no fue aprobada'])

@section('contenido')
<p style="margin:0 0 12px;">Hola,</p>
<p style="margin:0 0 16px;">Revisamos la solicitud de <strong>{{ $razonSocial }}</strong> y en esta ocasión no fue aprobada. No se concedió acceso institucional.</p>
<p style="margin:0 0 12px;">Motivo:</p>
<p style="margin:0 0 16px;">{{ $motivo }}</p>
<p style="margin:0;">Si deseas presentar una solicitud nueva, puedes hacerlo cuando cuentes con la información corregida. Esta decisión no modifica otras cuentas ni otros roles que ya tuvieras.</p>
@endsection
