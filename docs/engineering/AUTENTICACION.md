# Sesión interna de MasterExpress Control

Laravel autentica con el guard `web` y el usuario de ME-D0. Fortify aporta el controlador de sesión y su preparación posterior al ingreso. La aplicación registra solo sus operaciones de ingreso y cierre porque el conjunto predeterminado también publica rutas de confirmación de contraseña. Sanctum inicializa CSRF y aplica el middleware de sesión de la SPA a `/api/mi-sesion`. La ruta usa el guard `web` para aceptar únicamente sesión mediante cookie.

## Contrato HTTP

Envíe `Accept: application/json` y habilite credenciales en todas las peticiones del flujo. Los errores JSON contienen `message`. Los errores de validación incluyen `errors` por campo.

| Método y ruta | Éxito | Respuestas de error |
| --- | --- | --- |
| `GET /sanctum/csrf-cookie` | `204`. Inicializa la sesión y emite la cookie `XSRF-TOKEN`. | |
| `POST /login` | `204`. Recibe `email` y `password`, rota la sesión y actualiza `XSRF-TOKEN`. | `422` para entrada inválida o acceso rechazado, `409` si ya hay sesión, `419` por falta de CSRF y `429` por exceso de intentos. |
| `GET /api/mi-sesion` | `200`. Devuelve `data.id`, `data.nombre`, `data.correo` y `data.roles`. | `401` para acceso anónimo o sesión expirada. `403` si se revocaron todos los roles de acceso, con invalidación de esa sesión. |
| `POST /logout` | `204`. Invalida la sesión y renueva `XSRF-TOKEN`. | `401` sin sesión si CSRF es válido y `419` si CSRF falta o está vencido. |

Cada consulta vuelve a leer de `rol_user` los roles habilitados en el hito. Puede devolver `administrador`, `colaborador` o ambos. Una cuenta sin ninguno de los dos recibe el mismo mensaje que un correo inexistente o una contraseña incorrecta. La configuración limita a cinco intentos por correo normalizado e IP y a treinta por IP por minuto. `429` publica `Retry-After`. La sesión usa almacenamiento persistente del servidor, una cookie `HttpOnly`, `SameSite=Lax` y un vencimiento por inactividad de 120 minutos de forma predeterminada. `XSRF-TOKEN` es legible por la SPA para que pueda enviar `X-XSRF-TOKEN`. Las respuestas de sesión excluyen contraseñas, tokens y metadatos internos.

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

La pantalla única está en `/`. `/Home` redirige al mismo acceso. El proveedor mantiene la identidad en memoria y verifica `/api/mi-sesion` al arrancar, al navegar, al volver a la pestaña y cada 30 segundos mientras está visible. Durante la comprobación inicial se ocultan los paneles. Una respuesta `401` o `403` retira el acceso y vuelve al ingreso. Cerrar sesión invalida la cookie mediante Laravel.

| Ruta | Rol de Laravel |
| --- | --- |
| `/AdminDashboard` | Administrador |
| `/ColaboradorDashboard` | Colaborador |
| `/RegistroGraduando` | Colaborador. La operación requiere además un perfil de datos vinculado. |

Si una cuenta tiene los dos roles, el selector permite cambiar entre sus paneles. Las peticiones usan Fetch con credenciales. Antes de iniciar o cerrar se obtiene CSRF y se envía el valor decodificado de `XSRF-TOKEN` en `X-XSRF-TOKEN`. React reconcilia `409` consultando el servidor, informa `419` y solicita una nueva protección en el siguiente intento manual, y respeta `Retry-After` en `429`. `422` conserva un mensaje común. Los errores de red o del servidor se muestran sin detalles internos. La compilación espera que los endpoints de sesión estén publicados bajo el mismo origen HTTPS del frontend.

### Datos locales y servicios pendientes

Para habilitar las entidades ficticias de Base44, defina `VITE_BASE44_DATOS_LOCALES=true` antes de iniciar Vite. Use una sesión local de Laravel aprovisionada con el comando de cuentas ficticias. El modo local vincula al colaborador con un único perfil ficticio activo que tenga el mismo correo. El ID del registro de Base44 se conserva en las operaciones de graduandos. La prueba de navegador prepara sus datos y los aísla de servicios remotos.

Las entidades de personal, eventos, ceremonias, graduandos, precios, gastos, reportes y archivos siguen usando Base44. Sus políticas de lectura y escritura están pendientes de migración y verificación. Fuera del modo ficticio, la sesión permite abrir el panel y la ruta del colaborador, pero la consulta y el registro de graduandos esperan un vínculo de identidad aprobado en servidor. El avatar administrativo usa iniciales de Laravel hasta que exista un vínculo equivalente. El envío a papelera desde Registros de Graduandos queda fuera del flujo hasta contar con autorización en servidor para esa operación. La pantalla de Papelera conserva su comportamiento existente. Los formularios de gestión de personal de Base44 siguen siendo deuda heredada y no aprovisionan cuentas Laravel.

Vendedor, Finanzas, Inventario, Graduando e Institución requieren fases de implementación propias. Para ME-UI2 quedan la revisión visual y de accesibilidad de paneles y el contrato de perfiles operativos antes de conectar datos reales. El alta productiva, la recuperación de cuenta y las Policies por operación y recurso siguen pendientes.
