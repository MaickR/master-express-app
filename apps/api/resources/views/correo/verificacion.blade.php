@extends('correo.base', ['titulo' => 'Verifica tu correo'])

@section('contenido')
<p style="margin:0 0 12px;">Hola,</p>
<p style="margin:0 0 16px;">Usa este código para verificar tu correo y continuar con el registro en MasterExpress Control.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
    <tr>
        <td align="center" bgcolor="#E9D8BF" style="padding:16px 12px;color:#16181D;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;letter-spacing:4px;font-weight:bold;">{{ $codigo }}</td>
    </tr>
</table>
<p style="margin:0 0 12px;">El código vence {{ $vigencia }} minutos después de solicitarlo.</p>
<p style="margin:0;">Si tú no solicitaste el registro, puedes ignorar este mensaje.</p>
@endsection
