# Sesión de MasterExpress Control

Laravel autentica con el guard `web` y el usuario de ME-D0. Fortify aporta el controlador de sesión y su preparación posterior al ingreso. Las rutas se registran de forma explícita. Sanctum inicializa CSRF y aplica el middleware de sesión de la SPA a `/api/mi-sesion`. Recuperación usa el broker y la notificación nativos de Laravel. La aplicación define el contrato público de respuesta, el enlace de la SPA y la revocación de sesiones.

## Contrato HTTP

Envíe `Accept: application/json` y habilite credenciales en todas las peticiones del flujo. Los errores JSON contienen `message`. Los errores de validación incluyen `errors` por campo.

| Método y ruta | Éxito | Respuestas de error |
| --- | --- | --- |
| `GET /sanctum/csrf-cookie` | `204`. Inicializa la sesión y emite la cookie `XSRF-TOKEN`. | |
| `POST /login` | `204`. Recibe `email`, `password` y el booleano opcional `remember`. Rota la sesión y actualiza `XSRF-TOKEN`. | `422` para entrada inválida o acceso rechazado, `409` si ya hay sesión, `419` por falta de CSRF y `429` por exceso de intentos. |
| `GET /api/mi-sesion` | `200`. Devuelve `data.id`, `data.nombre`, `data.correo` y `data.roles`. | `401` para acceso anónimo o sesión expirada. `403` si se revocaron todos los roles de acceso, con invalidación de esa sesión. |
| `GET /api/administracion/cuentas` | `200`. Devuelve `data` con ID, nombre, correo y estado activo de cada cuenta interna y `hayMas` para paginar. | `401` sin sesión vigente y `403` sin rol Administrador. |
| `POST /api/administracion/cuentas/{cuenta}` | `204`. El cuerpo acepta solo `accion` con `suspender`, `reactivar` o `revocar-sesiones`. | `401` sin sesión vigente, `403` sin rol Administrador, `404` si la cuenta no existe o está fuera del personal interno, `409` al intentar suspender al último administrador activo, `419` sin CSRF y `422` si el cuerpo es inválido. |
| `POST /logout` | `204`. Invalida la sesión y renueva `XSRF-TOKEN`. | `401` sin sesión si CSRF es válido y `419` si CSRF falta o está vencido. |
| `POST /forgot-password` | `202` sin cuerpo para todo correo sintácticamente válido. Recibe `email` y encola la solicitud. | `419` sin CSRF, `422` para formato inválido y `429` al superar los límites. |
| `POST /reset-password` | `204`. Recibe `email`, `token`, `password` y `password_confirmation`. Consume el token y revoca las sesiones previas. | `419` sin CSRF, `422` para enlace inválido, vencido o consumido, o formulario inválido, y `429` por exceso de intentos. |

Cada consulta vuelve a leer de `rol_user` los roles habilitados. Puede devolver `administrador`, `colaborador`, ambos roles internos o `graduando` para una cuenta activa y verificada. Una cuenta sin acceso recibe el mismo mensaje que un correo inexistente o una contraseña incorrecta. El ingreso permite cinco intentos por correo normalizado e IP y treinta por IP por minuto. `429` publica `Retry-After`.

El panel de Administración ofrece **Cuentas internas** para cuentas con rol Administrador o Colaborador. Suspender rechaza futuros ingresos con el mensaje genérico de credenciales y revoca todas las sesiones y cookies de recuerdo previas. Reactivar solo habilita nuevos ingresos. Revocar sesiones deja el estado de la cuenta intacto y puede aplicarse a la propia cuenta. Un administrador puede suspender su propio acceso si queda otro administrador activo. Las operaciones conservan las asignaciones y la recuperación de contraseña. La recuperación cambia la contraseña, mientras que la reactivación sigue reservada a Administración.

La migración inicializa las cuentas existentes como activas y sus sesiones preexistentes con versión implícita cero. Cada revocación invalida el recuerdo, borra las sesiones de base de datos e incrementa la versión de sesión en la cuenta. El middleware rechaza una versión anterior aunque una petición en curso vuelva a guardar esa sesión. Configure la tabla de sesiones en la misma conexión de identidad para compartir la transacción.

`eventos_de_cuenta` guarda el ID del actor, el ID de la cuenta, la acción y la fecha de cada cambio aplicado. Suspender una cuenta ya suspendida o reactivar una cuenta ya activa devuelve `204` sin un evento adicional. Las referencias impiden borrar físicamente cuentas que figuran en el historial.

## Política de sesión

- La sesión ordinaria usa una cookie de sesión del navegador y caduca en el servidor tras 120 minutos de inactividad HTTP por defecto (`SESSION_LIFETIME`). Las consultas automáticas de una pestaña visible cuentan como actividad. Algunos navegadores pueden restaurar cookies de sesión al recuperar las pestañas.
- «Mantener sesión iniciada» está desmarcada inicialmente. Al activarla, Laravel emite su cookie de recuerdo para restaurar la sesión tras perder la cookie ordinaria. El servidor comprueba el vencimiento autenticado dentro de la cookie y conserva el mismo límite en la sesión restaurada. El plazo absoluto es de 24 horas desde el ingreso explícito y se mantiene al navegar o restaurar la sesión.
- Las cookies de sesión y recuerdo son cifradas, `HttpOnly` y `SameSite=Lax`. En producción deben ser `Secure` y de host, bajo el mismo origen HTTPS. `XSRF-TOKEN` es legible por la SPA para enviarlo como `X-XSRF-TOKEN`. Las respuestas de sesión excluyen contraseñas, tokens y metadatos internos.
- Cerrar sesión invalida la sesión actual, renueva CSRF y rota el token de recuerdo de Laravel para la cuenta. La rotación invalida otras cookies de recuerdo de la misma cuenta. Las sesiones ordinarias de otros equipos siguen su vigencia. El restablecimiento de contraseña revoca todas las sesiones y cookies de recuerdo de esa cuenta. Si se retiran todos los roles internos, la siguiente consulta de sesión corta el acceso.
- En un equipo compartido, deja la opción desmarcada y usa «Cerrar sesión» antes de abandonar el equipo.

## Recuperación y correo

La solicitud pública encola el mismo trabajo cifrado para cada correo válido. El trabajador resuelve la cuenta y envía correo a cuentas internas o a Graduandos activos y verificados. Los límites son tres solicitudes por correo normalizado y quince por IP cada quince minutos, y ocho intentos de restablecimiento por IP cada minuto. El broker conserva su límite de emisión de 60 segundos.

El token de Laravel se guarda con hash, caduca a los 30 minutos y se consume después de un restablecimiento exitoso. El cambio, el consumo y la revocación se ejecutan en la misma transacción sobre la base de identidad y sesiones. La contraseña requiere al menos 12 caracteres y admite hasta 72 bytes. Se aplica el hash del modelo de identidad. El flujo conserva los roles y termina con una confirmación y un enlace al inicio de sesión.

El correo apunta a `/restablecer-contrasena` con el token y el correo en el fragmento, que el navegador excluye de las solicitudes HTTP. React retira el fragmento de la URL al cargar y mantiene los datos en memoria hasta completar o abandonar el formulario. Recargar después de retirar el fragmento requiere volver a abrir el enlace original o solicitar uno nuevo. La pantalla de restablecimiento restringe la referencia al mismo origen. Las peticiones de recuperación usan JSON, CSRF y `Cache-Control: no-store`.

En local se usan únicamente destinatarios `@example.invalid`, el transporte `array` o un sumidero SMTP de bucle local. La suite de navegador levanta su propio sumidero y comprueba el correo sin guardar el mensaje. Para producción:

- Configure `APP_URL` con el origen HTTPS público de la SPA, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true` y `SESSION_DRIVER=database`. Las tablas `sessions`, `jobs`, `failed_jobs` y `password_reset_tokens` deben estar en la base de identidad ya migrada. Use caché compartida para los límites.
- Configure el [perfil SMTP de Resend](ME-REG1B-CORREO.md) con el dominio remitente verificado y su clave privada de entorno. Ejecute y supervise `php artisan queue:work database --queue=recuperacion`. El endpoint confirma recepción, por lo que el seguimiento de entrega se realiza en el trabajador y en el proveedor.
- Mantenga `QUEUE_FAILED_DRIVER=database-uuids` y revise `php artisan queue:failed` junto con los logs del trabajador. Los fallos distinguen entre configuración, preparación del enlace y entrega sin confirmación. Laravel conserva el trabajo cifrado y registra una excepción con un mensaje fijo. El trabajo tiene un solo intento automático. Antes de considerar un reintento manual, confirme con el proveedor si aceptó el mensaje. Una desconexión SMTP puede ocurrir después de la aceptación.
- Configure proxy, APM y proveedor de correo para excluir cuerpos de autenticación, cookies y credenciales de trazas, y para desactivar la reescritura y seguimiento de enlaces de recuperación. Sirva la SPA en la ruta de restablecimiento y aplique `Referrer-Policy: same-origin` y `Cache-Control: no-store` en la respuesta HTML de esa ruta.

Para ME-SEC1 queda validar en preproducción el correo, la configuración real del proxy y la redacción de datos en telemetría, además de formalizar la verificación y custodia del correo de las cuentas internas.

El [alta de Graduandos](ME-REG1A.md) y el [portal](ME-REG1B.md) usan la misma sesión web, el correo de Laravel y la protección CSRF de Sanctum.

## Entorno local

Sirva Vite en `http://127.0.0.1:5173` con `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Sirva Laravel en `http://127.0.0.1:8000` con `php artisan serve --host=127.0.0.1 --port=8000`. Los puertos distintos requieren CORS y comparten el mismo sitio si se conserva el host y esquema. `localhost` y `127.0.0.1` son hosts diferentes y tienen cookies distintas. Mantenga `SESSION_DOMAIN` sin definir para esta configuración. Defina o confirme los siguientes valores en el `.env` local excluido de Git.

```dotenv
SPA_ALLOWED_ORIGINS=http://127.0.0.1:5173
SANCTUM_STATEFUL_DOMAINS=127.0.0.1:5173,127.0.0.1:8000
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=false
```

La base preexistente incluye `sessions` y `cache`. El limitador usa caché `database` de forma predeterminada, incluso si `CACHE_STORE` es `array` para otras funciones locales. Para despliegue configure HTTPS, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, la lista exacta de orígenes y hosts, y un almacenamiento compartido si hay varias instancias. Si React y Laravel usan subdominios distintos del mismo dominio, configure el ámbito de cookies necesario para que el cliente pueda leer `XSRF-TOKEN`. Toda consulta de producción requiere claves y credenciales propias del entorno.

## Cuentas ficticias

Desde `apps/api/`, ejecute `php artisan auth:crear-cuenta-prueba`. El comando requiere una terminal interactiva, `APP_ENV=local` y confirma que MySQL abrió `masterexpress_control_dev` en `127.0.0.1`. Solicita nombre ficticio, un correo bajo `example.invalid`, uno o ambos roles internos y una contraseña oculta. Laravel aplica el hash y una transacción conserva la cuenta y sus roles juntos. Un correo existente se rechaza. Las pruebas automatizadas crean sus propias cuentas ficticias dentro de transacciones revertidas en `masterexpress_control_test`.

## Integración React desde ME-AUTH1B

La pantalla de acceso está en `/`. `/Home` redirige al mismo acceso. `/recuperar-contrasena` recibe el correo y `/restablecer-contrasena` recibe el enlace. El proveedor mantiene la identidad en memoria y verifica `/api/mi-sesion` al arrancar, al navegar, al volver a la pestaña y cada 30 segundos mientras está visible. Durante la comprobación inicial se ocultan los paneles. Una respuesta `401` o `403` retira el acceso y vuelve al ingreso. Cerrar sesión invalida la cookie mediante Laravel.

| Ruta | Rol de Laravel |
| --- | --- |
| `/AdminDashboard` | Administrador |
| `/ColaboradorDashboard` | Colaborador |
| `/RegistroGraduando` | Colaborador. La operación requiere además un perfil de datos vinculado. |
| `/portal/graduando` | Graduando activo y con correo verificado. |

Si una cuenta tiene los dos roles, el selector permite cambiar entre sus paneles. Las peticiones usan Fetch con credenciales. Antes de iniciar o cerrar se obtiene CSRF y se envía el valor decodificado de `XSRF-TOKEN` en `X-XSRF-TOKEN`. React reconcilia `409` consultando el servidor, informa `419` y solicita una nueva protección en el siguiente intento manual, y respeta `Retry-After` en `429`. `422` conserva un mensaje común. Los errores de red o del servidor se muestran sin detalles internos. La compilación espera que los endpoints de sesión estén publicados bajo el mismo origen HTTPS del frontend.

### Datos locales y servicios pendientes

Para habilitar las entidades ficticias de Base44, defina `VITE_BASE44_DATOS_LOCALES=true` antes de iniciar Vite. Use una sesión local de Laravel aprovisionada con el comando de cuentas ficticias. El modo local vincula al colaborador con un único perfil ficticio activo que tenga el mismo correo. El ID del registro de Base44 se conserva en las operaciones de graduandos. La prueba de navegador prepara sus datos y los aísla de servicios remotos.

Las entidades de personal, eventos, ceremonias, graduandos, precios, gastos, reportes y archivos siguen usando Base44. Sus políticas de lectura y escritura están pendientes de migración y verificación. Fuera del modo ficticio, la sesión permite abrir el panel y la ruta del colaborador, pero la consulta y el registro de graduandos esperan un vínculo de identidad aprobado en servidor. El avatar administrativo usa iniciales de Laravel hasta que exista un vínculo equivalente. El envío a papelera desde Registros de Graduandos queda fuera del flujo hasta contar con autorización en servidor para esa operación. La pantalla de Papelera conserva su comportamiento existente. Los formularios de gestión de personal de Base44 siguen siendo deuda heredada y no aprovisionan cuentas Laravel.

Vendedor, Finanzas, Inventario e Institución requieren fases de implementación propias. Para ME-UI2 quedan la revisión visual y de accesibilidad de paneles y el contrato de perfiles operativos antes de conectar datos reales. El alta productiva y las Policies por operación y recurso siguen pendientes.

## Aprovisionamiento protegido para la demo

ME-SEC-ADMIN1 usa Laravel en `testing` y el esquema `masterexpress_control_test` de una instancia MySQL dedicada que escucha en `127.0.0.1:33342`. La SPA se abre en `http://127.0.0.1:5199/` y la API escucha en `127.0.0.1:8039`. Use un perfil de Chrome independiente para que las cookies CSRF de los ensayos locales no se crucen.

Abra `%LOCALAPPDATA%\MasterExpressControl\ME-SEC-ADMIN1\Preparar-Ernesto.ps1` desde una consola interactiva de PowerShell. Introduzca y confirme una contraseña exclusiva de QA de al menos 12 caracteres y máximo 72 bytes. La cuenta `ernesto.demo@example.invalid` recibe únicamente `administrador`. El aprovisionamiento confirma la instancia y guarda el hash y el rol con los modelos Laravel. Si el correo ya existe, verifica la contraseña proporcionada y conserva la cuenta. El buzón ficticio sirve para iniciar sesión en la demo local.

### Procedimiento propuesto para un correo real

1. Confirme con Ernesto su buzón y la custodia de las credenciales. Antes del alta real, apruebe el procedimiento y pruébelo en preproducción con HTTPS, correo verificado y un registro de auditoría.
2. Aprovisione una cuenta nominativa con el rol acordado mediante una operación administrativa autorizada y auditada. Entregue al buzón confirmado un enlace de activación de uso único, limitado en tiempo y ligado a la cuenta. Ernesto establece su contraseña en ese flujo.
3. Para un cambio posterior, exija autenticación reciente y mantenga el correo vigente mientras el nuevo buzón esté pendiente. Verifique la posesión del nuevo correo con un token de un solo uso y vuelva a comprobar la unicidad antes de confirmar el cambio en una transacción.
4. Al confirmar, revoque las sesiones y tokens anteriores, avise al buzón anterior y audite el responsable y la fecha. Si la persona perdió acceso al buzón vigente, derive el caso a una recuperación aprobada y auditada con verificación de identidad.

La aplicación carece de un flujo administrativo aprobado para alta productiva o cambio de correo. La verificación de correo nuevo, la activación y el cambio auditado descritos aquí son condiciones para implementar y validar antes del uso real. Mantenga las credenciales fuera de Git, telemetría y capturas.

## Diagnóstico de acceso ME-ADMIN-QA2

Chrome confirmó que el frontend de 5173 consulta 8000, mientras 5199 consulta 8039. El arranque CLI habitual resuelve masterexpress_control_dev en 3306. El entorno QA explícito resuelve masterexpress_control_test en 33342. La cuenta ernesto.demo@example.invalid existe en QA, activa, con rol administrador y hash bcrypt. El correo ficticio figura sin verificar. Los administradores internos actualmente pueden acceder en ese estado.

El diagnóstico confirmó dos destinos de identidad distintos. La relación causal con el intento fallido original depende de la URL utilizada por la persona. No se trasladan cuentas ni hashes entre bases.

La rotación interactiva se realiza con %LOCALAPPDATA%\MasterExpressControl\ME-SEC-ADMIN1\Rotar-Ernesto.ps1. Exige una clave distinta de la actual, confirmación y límites de longitud. Usa Hash y RevocarSesiones dentro de una transacción y confirma el puerto y esquema antes de escribir. El resultado rotacion-qa2.json contiene únicamente indicadores de hash y revocación.

### Inventario observado en Chrome

| Sección | Fuente | Alcance verificado y pendiente |
| --- | --- | --- |
| Panel Principal | Base44 local | Indicadores visibles. Los eventos Laravel no alimentan este conteo. |
| Eventos | Laravel en ensayo | Listado y creación con ceremonias verificados en ME-OPS1A. Edición, borrado, cancelación y reprogramación pendientes. |
| Paquetes | Base44 local | Pantalla y precios visibles. Mutaciones comerciales fuera del ensayo. |
| Gastos | Base44 local | Estado vacío visible. Mutaciones fuera del ensayo. |
| Resumen Financiero | Base44 local | Indicadores visibles. Conciliación con Laravel pendiente. |
| Registros de Graduandos | Base44 local | Listado vacío visible. Identificadores independientes de Laravel. |
| Reportes | Base44 local | Filtros e indicadores visibles. Datos de Laravel pendientes. |
| Exportar a Excel | Base44 local | Filtros visibles. Archivo exportado no probado. |
| Cuentas internas | Laravel | Controles de suspensión, reactivación y revocación cubiertos en ME-SEC-ADMIN1. |
| Solicitudes institucionales | Laravel | Aprobar y rechazar desde Chrome guardó institución, sede, vínculo o motivo según el caso. |
| Vinculación de graduandos | Laravel | Vista revisada. Corrección, anulación e historial conservan la evidencia anterior. |
| Correos Electrónicos | Base44 local / EmailJS | Configuración visible. Entrega real no probada. Los avisos institucionales usan Laravel. |
| Papelera | Base44 local | Estado vacío visible. Restauración no repetida. |
| Colaboradores | Heredada aislada | Se retiraron navegación y acceso rápido porque el editor maneja el campo password de Base44. |

Los correos de aprobación y rechazo de QA2 se entregaron al transporte array local en memoria ejecutando el handler de notificación. Se comprobaron enlace de activación, motivo y estado enviada. Un fallo controlado dejó fallida la notificación de rechazo. El reintento autorizado encoló un job en una cola exclusiva de QA2. queue:work terminó con código 0, el sumidero recibió un mensaje y el estado volvió a enviada. Resend no fue probado.

La primera ejecución PHPUnit seleccionada tuvo siete casos satisfactorios y tres fallidos por supuestos de base vacía incompatibles con los fixtures persistentes. Una instancia temporal adicional fue detenida tras fallar por falta de espacio en C:. Esos fallos se conservan como limitación de la verificación y no prueban defectos de autorización.

Para reiniciar la demo, abra PowerShell en apps/api, cargue con dot-source el archivo entorno-qa2.ps1 de la carpeta local anterior y ejecute php artisan serve --host=127.0.0.1 --port=8039 --no-reload. En otra consola, desde la raíz del repositorio, defina VITE_BASE44_DATOS_LOCALES=true y VITE_API_LOCAL_PORT=8039 en el proceso y ejecute npm run dev -- --mode ensayo-laravel --host 127.0.0.1 --port 5199 --strictPort. MySQL debe usar la carpeta persistente ME-SEC-ADMIN1/mysql y el puerto 33342, con mysqlx deshabilitado. Compruebe listeners antes de iniciar servicios.

## Cierre ME-ADMIN-FINAL

PASS. La instancia temporal de MySQL en 33344 se creó vacía tras comprobar espacio libre. Se aplicó el esquema existente y se ejecutó exclusivamente PHPUnit focalizado de eventos, programación institucional, sesión, cuentas, decisiones y notificaciones. Resultado final de 24 pruebas y 657 aserciones. La instancia temporal quedó detenida. La demo de 33342 conservó sus datos.

PASS. Ernesto estableció una nueva clave mediante entrada oculta. Se verificaron hash nuevo, incremento de versión de sesión, revocación de sesiones anteriores, ingreso HTTP 204 y cierre seguido de HTTP 401. La clave introducida como actual fue rechazada antes del restablecimiento. NOT TESTED el rechazo HTTP de la contraseña anterior exacta, cuyo valor correcto no estuvo disponible. Las claves y el resultado privado del aprovisionamiento quedan fuera del repositorio.

PASS. Chrome con Ernesto creó un evento en Instituto Horizonte QA, Sede La Alameda, con dos ceremonias. Consultó el historial de aprobaciones y el detalle. Repetir la decisión devolvió HTTP 409. El panel quedó sin entradas de los editores heredados de credenciales. Los indicadores identifican Base44 como su origen.

PASS. Panel a 390 y 1440 px en claro y oscuro, ausencia de desbordamiento, menú móvil por teclado, Escape y retorno de foco. Se reutiliza la evidencia aceptada de zoom nativo al 200 %, diálogos, estados de error y vacío de las vistas conservadas.

PASS. Typecheck, build, ESLint afectado, sintaxis PHP y git diff --check. NOT TESTED producción, correo Resend y activación productiva de programación. No se agregaron migraciones en este cambio. Los incidentes anteriores de base persistente se conservan como historia del ensayo, con la corrida temporal final satisfactoria.
