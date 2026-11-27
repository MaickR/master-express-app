<!doctype html>
<html lang="es-CO">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $titulo }}</title>
</head>
<body style="margin:0;padding:0;background-color:#FBFAF7;color:#16181D;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FBFAF7" style="width:100%;background-color:#FBFAF7;">
    <tr>
        <td align="center" style="padding:24px 12px;">
            <!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center" bgcolor="#FFFFFF" style="width:100%;max-width:560px;background-color:#FFFFFF;border:1px solid #E9D8BF;border-top:4px solid #B48338;">
                <tr>
                    <td style="padding:24px 24px 16px;">
                        <img src="{{ $message->embed(resource_path('mail/master-express.png')) }}" alt="Logotipo de MasterExpress" width="64" height="54" style="display:block;width:64px;height:54px;border:0;">
                        <p style="margin:12px 0 0;font-size:14px;line-height:21px;font-weight:bold;color:#16181D;">MasterExpress Control</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 24px 24px;font-size:16px;line-height:25px;color:#16181D;">
                        <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;line-height:34px;font-weight:bold;color:#16181D;">{{ $titulo }}</h1>
                        @yield('contenido')
                    </td>
                </tr>
                <tr>
                    <td bgcolor="#E9D8BF" style="padding:16px 24px;background-color:#E9D8BF;color:#16181D;font-size:14px;line-height:21px;">
                        Equipo de MasterExpress Control
                    </td>
                </tr>
            </table>
            <!--[if mso]></td></tr></table><![endif]-->
        </td>
    </tr>
</table>
</body>
</html>
