@extends('correo.base', ['titulo' => 'Tu solicitud institucional fue aprobada'])

@section('contenido')
<p style="margin:0 0 12px;">Hola,</p>
<p style="margin:0 0 16px;">Aprobamos la solicitud de <strong>{{ $razonSocial }}</strong> ({{ $tipo }}, sede {{ $sede }}).</p>
@if ($url)
<p style="margin:0 0 16px;">Para ingresar, define tu contraseña con este enlace de un solo uso. Después podrás acceder con el correo verificado durante la solicitud.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
    <tr>
        <td bgcolor="#16181D" style="background-color:#16181D;">
            <a href="{{ $url }}" style="display:inline-block;border:1px solid #16181D;padding:12px 18px;color:#FBFAF7;font-size:16px;line-height:22px;font-weight:bold;text-decoration:underline;">Activar mi acceso</a>
        </td>
    </tr>
</table>
<p style="margin:0 0 12px;">Si el botón no funciona, usa el <a href="{{ $url }}" style="color:#8C602A;text-decoration:underline;">enlace directo de activación</a>.</p>
<p style="margin:0 0 12px;">El enlace vence {{ $vigencia }} minutos después de este mensaje y solo puede usarse una vez.</p>
@else
<p style="margin:0 0 12px;">Ya puedes ingresar con la cuenta de este correo. El acceso institucional queda limitado a la institución y la sede aprobadas.</p>
@endif
<p style="margin:0;">Hasta que el vínculo esté activo, la cuenta no consulta eventos, graduandos, ventas ni información de otras instituciones.</p>
@endsection
