# ME-REG2A · Solicitud institucional y decisión administrativa

El alta pública de Graduandos y su OTP siguen en [ME-REG1A](ME-REG1A.md). Esta fase reutiliza el mismo desafío de correo, las mismas plantillas base, Fortify, Sanctum, las policies y el rol `institucion`. ME-REG2B integra la bandeja administrativa, la activación y el portal institucional.

## Solicitud

Obtén `GET /sanctum/csrf-cookie`. Envía JSON con `Accept`, `Content-Type` y `X-XSRF-TOKEN`, y conserva la sesión.

| Método y ruta | Uso |
| --- | --- |
| `POST /api/registro-institucion/codigo` | `email`. También reenvía. `202` si el correo no tiene cuenta. |
| `POST /api/registro-institucion/confirmacion` | `email` y `codigo` de seis dígitos. `204`. |
| `POST /api/registro-institucion/solicitud` | `tipo` (`colegio` o `universidad`), `razon_social`, `nit`, `sede`, `representante`, `email` y `telefono`. `201` con la solicitud `pendiente`. |
| `POST /api/registro-institucion/representacion` | Sesión de una cuenta activa y verificada. Los mismos datos, sin `email`: el servidor usa el correo de la sesión. No cambia los roles. |
| `POST /api/registro-institucion/activacion` | `email`, `token`, `password` y `password_confirmation`. Solo el enlace de un solo uso, después de la aprobación de un representante nuevo. `204`. |

`Colegio` y `Universidad` se envían como `colegio` y `universidad`. El correo se recorta y pasa a minúsculas. El NIT se conserva como texto: dígitos o dos grupos de dígitos separados por un guion. El nombre admite letras Unicode. El teléfono admite de 7 a 15 dígitos. Un campo ajeno responde `422` en `errors.solicitud`.

Si el correo ya tiene cuenta, el alta pública responde `422` en `email` y no envía otro código. La persona debe iniciar sesión. Una cuenta sin correo verificado no puede solicitar la representación.

El código dura 10 minutos, espera 60 segundos para reenviarse y admite cinco intentos. Esas reglas viven en `DesafioDeCorreo` y no en un servicio paralelo. La cola del código institucional es `registro-institucion`.

## Decisión

Solo un administrador activo. Otra sesión recibe `401` o `403`.

| Método y ruta | Resultado |
| --- | --- |
| `GET /api/administracion/solicitudes-institucionales` | Solicitudes `pendiente`. |
| `GET /api/administracion/solicitudes-institucionales/{id}` | Detalle, decisión y estado de la notificación. |
| `GET /api/administracion/solicitudes-institucionales/decisiones` | Historial de aprobaciones y rechazos. |
| `POST .../{id}/aprobacion` | Cuerpo vacío. Confirma institución, sede y vínculo. |
| `POST .../{id}/rechazo` | Exige `motivo` claro. |
| `POST .../{id}/notificacion` | Reintenta el correo si quedó `pendiente` o `fallida`. `202`. No repite la decisión. |

Una segunda decisión responde `409`. Un NIT ya registrado también responde `409` y deja la solicitud `pendiente`, sin vincularla a la institución existente. El correo se encola después de confirmar la transacción. Si el envío falla, la decisión permanece y `notificacion.estado` queda en `fallida`, con un texto fijo y sin secretos.

El representante nuevo recibe «Tu solicitud institucional fue aprobada» y un enlace hacia `/activar-institucion`. Hasta usarlo no tiene rol ni puede entrar. La cuenta que ya existía recibe el mismo asunto, sin enlace, y entra con su contraseña actual. El rechazo usa «Tu solicitud institucional no fue aprobada» e incluye el motivo.

## Interfaz ME-REG2B

`/registro/institucion` envía la solicitud real. El tipo se muestra como Colegio o Universidad y viaja como `colegio` o `universidad`. Una sesión anónima verifica el correo con el OTP compartido. Una sesión autenticada usa `POST /api/registro-institucion/representacion` y no envía el correo en el cuerpo. La pantalla final dice que la solicitud fue recibida y está pendiente de revisión.

`/activar-institucion` lee el fragmento `token` y `email`, lo retira de la barra de dirección y llama `POST /api/registro-institucion/activacion`. El enlace vencido, usado o todavía no aprobado comparte la respuesta `422` del servidor. Después de activar, el ingreso lleva a `/portal/institucion`, que no consulta eventos ni datos de otras instituciones.

Regla provisional: no se distingue en pantalla si el enlace falló por vencimiento, consumo, rechazo o solicitud pendiente, porque el servidor responde igual para no revelar el estado.

## Acceso

El rol `institucion` y un vínculo `activo` se comprueban juntos. Sin ese par no hay acceso a eventos, graduandos, ventas, pagos ni a otra institución. Una cuenta con el rol Graduando y un vínculo institucional activo puede elegir ambos paneles desde la misma sesión. Administrador y Colaborador conservan la prioridad de los roles internos. Una cuenta con acceso institucional como único rol de sesión también puede iniciar sesión. `/portal/institucion` muestra la institución, la sede y el representante del vínculo activo. No consulta eventos ni datos de otras instituciones: la programación institucional sigue sin una consulta autorizada y la pantalla informa ese vacío. La bandeja del administrador está en el panel, sección «Solicitudes institucionales», y usa los endpoints de decisión ya existentes. El listado acepta `estado=pendiente|aprobada|rechazada`.

## QA

La cuenta ordinaria de `masterexpress_control_test` en el servidor habitual no tiene permiso `ALTER`. El 27 de noviembre de 2026 la suite corrió en una instancia MySQL 9.1 desechable, solo en `127.0.0.1:3317`, con el esquema `masterexpress_control_test` creado para esa corrida. No se usó la base de desarrollo. El correo fue el transporte `array` hacia `@example.invalid`.

`php vendor/bin/phpunit --configuration phpunit.xml tests/MySql/RegistroInstitucionTest.php` — **PASS**, 18 pruebas, 443 aserciones.

`php vendor/bin/phpunit --configuration phpunit.xml tests/MySql/RegistroGraduandoTest.php tests/MySql/SesionTest.php tests/MySql/RegistrosTest.php tests/MySql/EventosTest.php tests/Feature` — **PASS**, 80 pruebas, 1.511 aserciones.

Resend y un dominio de pago no hicieron falta.

### Cierre ME-REG2B

- Navegador con MySQL aislado y correo local. Aprobación y activación del colegio, rechazo motivado de la universidad y aprobación de un Graduando con la cuenta original. Los tres escenarios pasaron.
- `php vendor/bin/phpunit --configuration phpunit.xml tests/MySql/RegistroInstitucionTest.php tests/MySql/SesionTest.php` — **PASS**, 41 pruebas y 1.059 aserciones sobre una copia limpia del esquema.
- `npm run typecheck`, `npm run build` y `git diff --check` — **PASS**.
- Registro, detalle administrativo y portal revisados en Claro y Oscuro a 390 × 844 y 1440 × 900. Total de 12 comprobaciones visuales.

### Resend Sandbox

La verificación puntual de cierre usó las plantillas institucionales con datos ficticios y el único buzón autorizado del perfil privado. La muestra de rechazo recibió aceptación SMTP 250. La muestra de aprobación tuvo un error de transporte sin código SMTP. La recepción humana sigue pendiente. El remitente de pruebas solo permite el buzón asociado a la cuenta de Resend. [Restricción de Resend Sandbox](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
