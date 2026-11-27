# ME-REG1B · Registro y portal de Graduandos

El formulario de Graduando usa los tres endpoints de [ME-REG1A](ME-REG1A.md). Conserva los pasos Datos, Acceso y Revisión. Al continuar con los datos de acceso válidos, el formulario solicita el código una sola vez y muestra el destino enmascarado. Volver al paso con el mismo correo conserva la solicitud. Si se edita el correo, el formulario pide una verificación nueva. Datos, contraseña y código viven en la memoria del formulario. Los fallos recuperables preservan los datos ingresados. Cada operación renueva CSRF antes de enviar y respeta `Retry-After` en `429`.

La cuenta activa con correo verificado y rol Graduando usa `/login`, `/api/mi-sesion`, `/logout`, `/forgot-password` y `/reset-password`. Conserva las reglas de expiración, recuerdo y revocación de sesiones. El portal en `/portal/graduando` muestra el nombre y el correo de la cuenta autenticada. Las Policies y el catálogo de administración siguen usando solo los roles internos. Si una cuenta tiene un rol interno y Graduando, la sesión conserva los destinos internos. El estado de acceso de Graduando se vuelve a comprobar al consultar la sesión y al recuperar la contraseña.

## Demostración local

| Pantalla | URL |
| --- | --- |
| Registro | `http://127.0.0.1:5173/registro/graduando` |
| Ingreso y recuperación | `http://127.0.0.1:5173/` |
| Portal | `http://127.0.0.1:5173/portal/graduando` |
| Bandeja de QA | `http://127.0.0.1:8026/` |

Usa un correo nuevo bajo `@example.invalid`, datos ficticios y una contraseña de al menos 12 caracteres. Completa Datos y Acceso y elige **Continuar** para solicitar el código. Actualiza la bandeja hasta encontrar el mensaje del destinatario. Ingresa los seis dígitos, confirma el correo, revisa los datos y selecciona **Crear cuenta**. Inicia sesión y verifica el cierre desde el menú de cuenta del portal. Para recuperar la contraseña, usa **¿Olvidaste tu contraseña?** y abre el enlace de la bandeja.

La bandeja de QA se inicia con `node tests/correo-registro-local.mjs`. Escucha en loopback y conserva mensajes ficticios en memoria. En Laravel, usa el entorno `testing`, el esquema temporal `masterexpress_control_test`, una clave exclusiva de QA, el controlador de sesiones `database`, caché de límites compartida y la conexión de cola de la base temporal. Configura `MAIL_MAILER=smtp` y `MAIL_URL=smtp://127.0.0.1:2526`. Inicia `php artisan queue:work database --queue=registro-graduando,recuperacion --env=testing` junto a Laravel en el puerto 8000 y Vite en el 5173.

## QA

Con los tres servicios y el trabajador activos, ejecuta `node tests/registro-graduando.mjs "<ruta de Chrome>"` desde la raíz. El test usa el directorio de datos de MySQL desechable indicado en `ME_REGISTRO_MYSQL_TEMPORAL`, y las variables de la cuenta ordinaria de ese entorno. Comprueba estados HTTP reales y simula una respuesta `503` desde Chrome para comprobar la recuperación del formulario. El vencimiento y la espera de reenvío se reproducen sobre filas ficticias de la instancia temporal. La prueba verifica también 320, 390, 768, 1024 y 1440 px en Claro, Oscuro y Sistema.

La validación del portal y de la recuperación se incluye en `php vendor/bin/phpunit --configuration phpunit.xml tests/MySql`. Esta fase reutiliza el esquema de ME-REG1A.

Si el puerto 8000 está ocupado por la demostración con Resend, sirve una segunda API de QA en loopback con otra base temporal y un trabajador de correo simulado. Indica su origen en `ME_REG1C_API` al ejecutar la prueba de Chrome. Solo la instancia automatizada usa esa API alternativa.

El 27 de noviembre de 2026 pasaron 69 pruebas MySQL con 1.441 aserciones y 9 pruebas Feature con 58 aserciones. Chrome completó el registro, la recuperación y el control de acceso. Se comprobaron 60 combinaciones de pantalla, ancho y tema en Datos, Verificación, Revisión y Portal. MySQL de PHPUnit se preparó aparte de la instancia temporal de la demostración.
