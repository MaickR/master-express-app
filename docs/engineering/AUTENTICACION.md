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

## Integración de React en ME-AUTH1B

Inicialice CSRF antes del ingreso. En Axios use `withCredentials: true` y `withXSRFToken: true`. Con Fetch use `credentials: 'include'` y envíe el valor decodificado de `XSRF-TOKEN` en `X-XSRF-TOKEN` para las operaciones mutables. Consulte `/api/mi-sesion` después del ingreso y al recuperar la aplicación. Gestione `401` y `403` limpiando la identidad en memoria, `419` obteniendo una nueva protección CSRF y `429` respetando `Retry-After`. Guarde la sesión en la cookie que administra Laravel.

El alta productiva, verificación de correo, recuperación de contraseña y bloqueo administrativo quedan pendientes. Retirar todos los roles habilitados revoca el acceso actual. La extensión a Vendedor, Finanzas e Inventario reutiliza el mismo ingreso tras aprobar el acceso. Las Policies futuras deberán validar cada operación y sus vínculos por institución, ceremonia u otro recurso. El rol institucional requiere su propio alcance de recursos aprobado.
