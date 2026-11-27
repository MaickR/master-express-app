# ME-REG1B · Correo transaccional de MasterExpress

Laravel usa SMTP con TLS implícito para Resend y reutiliza los trabajos cifrados de registro y recuperación. Los mensajes se generan en Blade como HTML y texto plano. La plantilla base incluye el logotipo corporativo como adjunto en línea, con texto alternativo. El nombre de la marca, el código, la acción y las instrucciones están disponibles aunque el cliente oculte imágenes.

## Configuración para correo real

| Variable | Valor o procedencia |
| --- | --- |
| `MAIL_MAILER` | `smtp` |
| `MAIL_HOST` | `smtp.resend.com` |
| `MAIL_PORT` | `465` |
| `MAIL_SCHEME` | `smtps` |
| `MAIL_USERNAME` | `resend` |
| `RESEND_API_KEY` | Secreto privado inyectado en el entorno del servidor. Usa una clave con permiso de envío para el dominio remitente. |
| `MAIL_FROM_NAME` | `MasterExpress Control` |
| `MAIL_FROM_ADDRESS` | Dirección corporativa del dominio exacto que se verificó en Resend. |
| `ME_CORREO_DOMINIO_VERIFICADO` | Dominio o subdominio exacto cuyo estado de envío figure como verificado en Resend. |

Para Resend, deja `MAIL_URL` sin definir. Laravel toma la contraseña SMTP de `RESEND_API_KEY` en este perfil. Mantén la verificación de certificados y reinicia los trabajadores después de cambiar la configuración. Si el entorno usa caché de configuración, regénérala con el mecanismo habitual de despliegue y mantén sus archivos fuera de Git y del acceso web. Las opciones de SMTP están en la [documentación de Resend](https://resend.com/docs/send-with-smtp).

`ME_CORREO_DOMINIO_VERIFICADO` declara el dominio aprobado por el operador. Valida que el remitente pertenezca a ese dominio. La comprobación del estado de envío se realiza en [Domains de Resend](https://resend.com/domains). Compara los registros publicados con los nombres y valores exactos que indique ese panel. Consulta los TXT de SPF y DKIM, los registros de retorno que indique Resend y el TXT de DMARC que corresponda a la política del dominio. Con un nombre de registro confirmado, puedes consultar `Resolve-DnsName -Name <nombre-exacto> -Type TXT` o el tipo correspondiente. Mantén desactivado el seguimiento de clics y aperturas en el correo de autenticación. [Dominios verificados de Resend](https://resend.com/docs/dashboard/domains/introduction)

## Prueba real controlada en local

1. Mantén `APP_ENV=local`. Con el dominio verificado y un único buzón real expresamente autorizado, configura `ME_CORREO_REAL_LOCAL=true` y coloca las direcciones autorizadas en `ME_CORREO_DESTINATARIOS`, separadas por comas. La opción viene desactivada y solo funciona en el entorno `local`. `testing` conserva `@example.invalid` y transporte simulado.
2. Para probar recuperación real en local, define `ME_CORREO_URL_SPA_LOCAL` con el origen HTTPS del entorno de prueba que sirve la pantalla de recuperación y llega a su API. El token sigue en el fragmento del enlace. Usa un ambiente aislado con cuentas de prueba y colas propias.
3. Reinicia los trabajadores y ejecuta `php artisan queue:work database --queue=registro-graduando,recuperacion`. Prueba primero el remitente y el buzón desde Resend. Después solicita un OTP desde el formulario y haz una recuperación con una cuenta de prueba elegible. Comprueba cada mensaje en Emails de Resend y en la bandeja real. `202` confirma la recepción de la solicitud por Laravel. La aceptación SMTP y la recepción deben verificarse por separado.
4. Comprueba asunto, lectura con imágenes bloqueadas, enlace de recuperación y aspecto en los clientes objetivo. Si hay un rechazo, revisa el estado de envío en Resend y el tipo de fallo del trabajo en Laravel. Los diagnósticos de los trabajos usan mensajes fijos sin cuerpo ni credenciales. Restablece `ME_CORREO_REAL_LOCAL=false` y reinicia el trabajador al terminar.

Para QA automatizado usa el transporte `array` o SMTP de loopback y destinatarios `@example.invalid`. El OTP vence a los 10 minutos desde la solicitud. La recuperación toma la vigencia del broker de Laravel, que actualmente es de 30 minutos.

## Demostración gratuita con Resend Sandbox

Usa el mismo perfil SMTPS y la clave privada del entorno. En `APP_ENV=local`, configura `ME_CORREO_REAL_LOCAL=true`, `ME_CORREO_RESEND_SANDBOX=true` y `MAIL_FROM_ADDRESS=onboarding@resend.dev`. Coloca únicamente el buzón asociado a tu cuenta de Resend en `ME_CORREO_DESTINATARIOS`. El modo Sandbox admite ese remitente sin dominio propio y Resend aplica su restricción de destinatario de prueba. Deja `ME_CORREO_URL_SPA_LOCAL=http://127.0.0.1:5173` para abrir el enlace de recuperación en la misma máquina de la demostración. [SMTP de Resend](https://resend.com/docs/send-with-smtp)

Usa una base MySQL de demostración aislada y un trabajador de cola con el mismo entorno y base de datos que la API. Solicita un solo mensaje inicial y comprueba primero la aceptación en Resend y la recepción en el buzón. Luego completa el registro con un OTP, inicia y cierra sesión y prueba la recuperación desde el enlace local. Al terminar, desactiva los dos indicadores y reinicia el trabajador. Para un dominio propio, deja `ME_CORREO_RESEND_SANDBOX=false` y usa el perfil de dominio verificado. En producción, el enlace de recuperación requiere HTTPS.
