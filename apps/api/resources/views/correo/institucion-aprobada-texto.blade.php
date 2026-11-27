Tu solicitud institucional fue aprobada

Hola,

Aprobamos la solicitud de {{ $razonSocial }} ({{ $tipo }}, sede {{ $sede }}).
@if ($url)
Para ingresar, define tu contraseña con este enlace de un solo uso:

{!! $url !!}

El enlace vence {{ $vigencia }} minutos después de este mensaje y solo puede usarse una vez.
@else
Ya puedes ingresar con la cuenta de este correo. El acceso institucional queda limitado a la institución y la sede aprobadas.
@endif
Hasta que el vínculo esté activo, la cuenta no consulta eventos, graduandos, ventas ni información de otras instituciones.

Equipo de MasterExpress Control
