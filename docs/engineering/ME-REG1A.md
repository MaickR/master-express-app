# ME-REG1A · API de alta de Graduandos

Laravel crea una cuenta verificada en `users` y asigna el rol `graduando` mediante `rol_user`. La inscripción del graduando en una ceremonia se gestiona por separado. El alta deja al navegador en sesión anónima. El ingreso de Graduandos corresponde a [ME-REG1B](ME-REG1B.md).

## Contrato para ME-REG1B

Obtén primero `GET /sanctum/csrf-cookie`. Envía las tres peticiones con credenciales, `Accept: application/json`, `Content-Type: application/json` y el valor decodificado de la cookie `XSRF-TOKEN` en `X-XSRF-TOKEN`. Conserva la misma sesión. Envía los datos en el cuerpo JSON y mantén el código y la contraseña en memoria durante el formulario.

| Método y ruta | Cuerpo | Éxito |
| --- | --- | --- |
| `POST /api/registro-graduando/codigo` | `email`. Usa la misma ruta para reenviar. | `202` vacío para una solicitud aceptada. Comunica que el código se enviará si corresponde. |
| `POST /api/registro-graduando/confirmacion` | `email`, `codigo` como texto de seis dígitos ASCII. | `204` vacío. El navegador dispone de 10 minutos para enviar el alta. |
| `POST /api/registro-graduando/cuenta` | `email`, `nombres`, `apellidos`, `telefono`, `password`, `password_confirmation` y la pareja opcional `tipo_documento`, `numero_documento`. | `204` vacío. Un reintento de la misma sesión y correo mientras siga vigente la confirmación devuelve el mismo estado y conserva la cuenta original. |

Mapea `correo` a `email`, `contrasena` a `password`, `confirmacion` a `password_confirmation`, `tipoDocumento` a `tipo_documento` y `numeroDocumento` a `numero_documento`. Envía `cedula_ciudadania` para «Cédula de ciudadanía» y `tarjeta_identidad` para «Tarjeta de identidad». Envía los dos campos de documento juntos o ambos ausentes o nulos. El número conserva los ceros iniciales y admite de 1 a 32 dígitos ASCII.

El correo se recorta y se convierte a minúsculas antes de validarlo, con tope de 254 caracteres. Nombres y apellidos admiten hasta 150 caracteres cada uno, con letras Unicode, marcas combinantes y signos propios del nombre. El teléfono es texto de hasta 30 caracteres, con 7 a 15 dígitos, indicativo opcional y separadores habituales. La contraseña sigue la regla del servidor de 12 caracteres como mínimo y 72 bytes como máximo, sin caracteres nulos y con confirmación idéntica. Los campos ajenos al contrato se rechazan con `errors.solicitud`.

| Estado | Manejo en React |
| --- | --- |
| `419` | Renueva CSRF y permite repetir de forma explícita. Si cambió la sesión, solicita un código nuevo. |
| `422` | Muestra `errors` por campo. En `confirmacion`, un código inválido, vencido, usado o de otra sesión tiene el mismo mensaje. En `cuenta`, `errors.email` indica que hace falta verificar el correo. |
| `429` | Respeta `Retry-After` en segundos. Evita reintentos automáticos durante la espera. |
| `500` | Muestra el mensaje genérico y permite repetir. Si se perdió la respuesta de confirmación y el código ya se consumió, intenta el alta con la misma sesión y correo. Si el alta pide verificación, solicita un código nuevo. |

Las respuestas usan `Cache-Control: no-store`. Si se edita el correo, descarta la verificación visible y vuelve al paso del código. El identificador de sesión del servidor liga el alta al navegador. Un reenvío aceptado sustituye el desafío anterior para el correo, incluso si se inicia desde otra sesión.

## Operación y seguridad

- El código aleatorio dura 10 minutos desde su generación. Su HMAC usa la clave de aplicación con separación por propósito y se liga al correo normalizado, la sesión y una emisión única. Tras confirmar el código se elimina su HMAC y se concede una sola alta. El bloqueo de fila protege cinco intentos por desafío y el plazo de 60 segundos entre envíos aceptados.
- Las solicitudes de código admiten 3 peticiones por correo y 15 por IP cada 15 minutos. Las confirmaciones y altas comparten 20 peticiones por correo cada 15 minutos y 30 por IP por minuto. Los intentos prematuros cuentan hacia estos límites. Conserva el almacenamiento compartido de los limitadores y la identificación de IP del proxy de confianza.
- La solicitud escribe el desafío y su trabajo cifrado en la misma transacción. El trabajador omite emisiones sustituidas o vencidas y correos con una cuenta existente. El envío aceptado por SMTP puede llegar tarde. Solo el código vigente se puede confirmar. La restricción única de `users.email` arbitra carreras con otros aprovisionamientos. Si esa dirección ya está ocupada al guardar, la respuesta permanece vacía y la cuenta existente conserva su contraseña y sus roles.
- En QA y en local por defecto se admiten destinatarios `@example.invalid` con el transporte `array` o SMTP de loopback. El [perfil Resend](ME-REG1B-CORREO.md) usa TLS implícito y un dominio verificado. La conexión `database` de la cola debe apuntar a la misma conexión de Laravel que `users`. Ejecuta `php artisan queue:work database --queue=registro-graduando` con la migración aplicada, `RolSeeder` ejecutado y la misma `APP_KEY` que la API. Un trabajo dispone de un intento automático y deja un mensaje fijo si falla.
- Ejecuta el programador de Laravel para borrar desafíos vencidos cada hora. Usa HTTPS, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, sesiones de servidor compartidas y orígenes CORS explícitos. En proxy, APM y proveedor de correo, excluye los cuerpos, las cookies, las credenciales y el contenido de los mensajes de las trazas y del seguimiento. El cliente debe excluir estas rutas y sus cuerpos de cachés, colas sin conexión y telemetría.

La migración `2026_11_26_000005_crear_altas_de_graduandos` introduce la tabla de desafíos y los campos opcionales para cuentas existentes en `users`. Amplía el nombre completo para incluir dos campos de hasta 150 caracteres. El método inverso conserva ese ancho para evitar truncar nombres existentes. Las decisiones de producto están en el [dominio V1](../product/ME-DOMINIO-V1.md#14-alta-pública-de-graduandos).

## QA

Desde `apps/api`, ejecuta `php vendor/bin/phpunit --configuration phpunit.xml --testsuite Feature`. Para `php vendor/bin/phpunit --configuration phpunit.xml tests/MySql`, usa una instancia MySQL temporal de loopback con el esquema `masterexpress_control_test`, las migraciones y los roles ya preparados por su cuenta administrativa. Indica la ruta del directorio de datos temporal en `ME_REGISTRO_MYSQL_TEMPORAL` para habilitar el caso que coordina dos peticiones HTTP en procesos separados. Ejecuta las pruebas con la cuenta ordinaria del esquema y el transporte de correo `array`.
