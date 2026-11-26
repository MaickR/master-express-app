# ME-E1B — Ensayo de eventos con Laravel en React

Base de implementación en `develop` — `8806d167501b052605991a40ba92994ec649e46d` (ME-E1A, PR #16).

## Comportamiento

`GestionEventos.jsx` conserva su listado, orden, tarjetas, diálogo y validaciones. Fuera del ensayo sigue usando Base44 sin cambios, incluido el borrado heredado.

El ensayo se activa solo cuando Vite corre en desarrollo, en `127.0.0.1` y con `--mode ensayo-laravel`. La compilación descarta ese camino. En el ensayo:

- La pantalla muestra un aviso de modo de ensayo y el diálogo indica que Base44 no recibe el evento.
- El listado usa `GET /api/eventos` con paginación incremental. Las ceremonias de cada evento se consultan al abrir su detalle.
- El alta elige una institución de `GET /api/instituciones`, que comparte la concesión de la Policy del ensayo. No acepta nombres libres ni identificadores ajenos a la lista.
- Cada alta genera un `operation_id` UUID y lo conserva en los reintentos hasta recibir `201` o `409`. Ante `409` se recarga la lista y el siguiente intento usa un identificador nuevo.
- `401`, `403`, `409`, `419`, `422` y los fallos de red muestran mensajes recuperables. `422` marca el campo afectado.
- El borrado no se muestra porque Laravel no ofrece esa operación.

## Preparación del ensayo

La base `masterexpress_control_test` debe tener aplicadas todas las migraciones. Desde `apps/api/`, con `APP_ENV=testing`, `DB_CONNECTION=mysql_pruebas` y una contraseña ficticia de 12 caracteres a 72 bytes en `ME_QA_CLAVE` solo en el proceso, ejecute `php artisan qa:ensayo-eventos preparar`. El comando confirma la base aislada, crea tres instituciones ficticias de forma idempotente y activa la cuenta Administrador `qa.eventos@example.invalid`.

Sirva Laravel en `127.0.0.1:8000` con esas mismas variables y los valores SPA de [AUTENTICACION.md](AUTENTICACION.md#entorno-local). Sirva Vite con `VITE_BASE44_DATOS_LOCALES=true` y `--mode ensayo-laravel`. Al terminar, ejecute `php artisan qa:ensayo-eventos cerrar` para suspender la cuenta ficticia y revocar sus sesiones. Las pruebas MySQL esperan que no queden administradores activos ajenos a cada caso.

## Pendientes

- Aplicar las migraciones `2026_11_25_000002` y `2026_11_25_000003` en `masterexpress_control_test`. La cuenta de pruebas tiene solo `SELECT`, `INSERT`, `UPDATE` y `DELETE`.
- Completar el QA en MySQL y navegador del alta, los reintentos, los conflictos y los estados de error.
- Mantener abiertas las decisiones de [ME-E1A](ME-E1A.md#decisiones-abiertas).
