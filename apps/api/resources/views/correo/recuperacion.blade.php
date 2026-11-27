@extends('correo.base', ['titulo' => 'Restablece tu contraseña'])

@section('contenido')
<p style="margin:0 0 12px;">Hola,</p>
<p style="margin:0 0 16px;">Recibimos una solicitud para cambiar la contraseña de tu cuenta de MasterExpress Control.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
    <tr>
        <td bgcolor="#16181D" style="background-color:#16181D;">
            <a href="{{ $url }}" style="display:inline-block;border:1px solid #16181D;padding:12px 18px;color:#FBFAF7;font-size:16px;line-height:22px;font-weight:bold;text-decoration:underline;">Restablecer mi contraseña</a>
        </td>
    </tr>
</table>
<p style="margin:0 0 12px;">Si el botón no funciona, usa el <a href="{{ $url }}" style="color:#8C602A;text-decoration:underline;">enlace directo de recuperación</a>.</p>
<p style="margin:0 0 12px;">El enlace vence {{ $vigencia }} minutos después de solicitarlo.</p>
<p style="margin:0;">Si tú no solicitaste el cambio, puedes ignorar este mensaje. Tu contraseña seguirá siendo la misma.</p>
@endsection
