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

## Evidencia de ME-E1B-QA

QA del 26 de noviembre de 2026 sobre `cbdbb47971fb83d779d019e8b000bd7e11b9d0ee`, con `develop` en `8806d167501b052605991a40ba92994ec649e46d`.

| Comprobación | Resultado |
| --- | --- |
| Conexión MySQL mediante `mysql_pruebas` | **PASS**. MySQL 9.1.0 en `127.0.0.1:3306`, esquema `masterexpress_control_test`, cuenta efectiva `masterexpress_test@127.0.0.1` y verificación de claves foráneas activa. |
| `migrate --database=mysql_pruebas --env=testing` y `migrate:status` | **FAIL inicial, PASS tras corregir el permiso**. MySQL rechazó el primer `ALTER` de `users` con error 1142. La sesión administrativa sustituyó la concesión DDL con guiones bajos sin escapar por la concesión sobre el esquema literal. `000002` y `000003` quedaron aplicadas en el lote 2. |
| Integridad en `information_schema` | **PASS**. Cinco claves foráneas, índice por fecha e ID, unicidad de operación por actor y de orden por evento. Los conteos de usuarios, roles, vínculos, sesiones y caché preexistentes coincidieron justo después de migrar. |
| `composer test:mysql` | **PASS**. 33 casos y 730 aserciones. En QA1 fueron 30 fallos de preparación por tablas pendientes. En QA2 pasaron los 20 casos de sesión, los 10 de eventos y los 3 de identidad. |
| CORS del ensayo | **FAIL inicial, PASS tras el ajuste**. Laravel omitía las cabeceras CORS para el origen local de Vite. Se incorporaron las rutas de instituciones, eventos y ceremonias a la configuración de `testing`. El preflight del alta respondió `204` con el origen permitido y credenciales. |
| `npm run typecheck:legacy` | **FAIL** heredado con 414 diagnósticos. La rama original tenía 424. Se corrigieron ocho diagnósticos en `GestionEventos.jsx` (líneas originales 336, 343, 346, 349, 351, 465, 476 y 504) y dos en `cliente-eventos.ts` (8 y 9). La comparación por ruta conserva el resultado de `develop`. |
| `npm run typecheck` y `npm run build` | **PASS**. La compilación se escribió en una carpeta temporal y excluye el código del ensayo. El plugin informó que faltaba la configuración de Base44 para esa compilación local y que los datos de compatibilidad de navegadores estaban desactualizados. |
| `composer test` y `php vendor/bin/pint --test` | **PASS**. 8 pruebas Feature y 47 aserciones, incluida la comprobación de CORS para orígenes permitidos y denegados. Pint pasó. |
| `node tests/vinculo-ceremonias.mjs "<Chrome>"` | **PASS**. 19 comprobaciones del circuito heredado con Base44 ficticio. |
| Chrome con API y MySQL reales | **PASS**. Ingreso de Administrador, tres instituciones ficticias, alta de tres ceremonias, persistencia tras recargar, detalle ordenado y paginación. El reintento del alta tras simular una respuesta perdida recuperó el mismo ID con el mismo UUID. Se comprobaron `401`, `409`, `419` y `422`, los temas Claro, Oscuro y Sistema, teclado, foco y el diálogo a 390 px. |
| Autorización desde Chrome | **PASS**. Una cuenta ficticia con el rol Colaborador inició sesión. Recibió `403` al consultar instituciones, listar eventos, consultar ceremonias y tratar de crear un evento. La Policy permaneció intacta. |
| Tráfico del ensayo en Chrome | **PASS**. DevTools capturó 247 solicitudes de la pestaña durante el ingreso, las consultas, el alta y los rechazos. Hubo cero solicitudes externas o a la API de Base44 y cero escrituras en sus entidades locales. Los únicos métodos de escritura fueron `POST` a `/login` y `/api/eventos` en Laravel. |
| Secretos y cierre de la cuenta ficticia | **PASS**. Se comprobaron las respuestas JSON de sesión, instituciones, eventos, ceremonias, alta y rechazo. La evidencia de red conserva solo el método, el origen y la ruta. `qa:ensayo-eventos cerrar` dejó la cuenta suspendida y con cero sesiones en MySQL. La cookie anterior recibió `401`. |
| Privilegios finales después de QA3 | **FAIL**. Una conexión nueva mostró todavía `CREATE`, `ALTER`, `INDEX` y `REFERENCES`, además de `SELECT`, `INSERT`, `UPDATE` y `DELETE`, sobre el esquema literal de QA. QA3 se limitó a consultar privilegios y estado de migraciones. `000002` y `000003` siguen aplicadas, con `masterexpress_control_dev` fuera del alcance de la cuenta. |

### Acceso administrativo temporal

Desde una sesión administrativa del mismo servidor, conceda los privilegios temporales sobre el esquema exacto de QA.

```sql
GRANT CREATE, ALTER, INDEX, REFERENCES ON `masterexpress\_control\_test`.* TO 'masterexpress_test'@'127.0.0.1';
```

Desde `apps/api/`, confirme el permiso con una conexión nueva y ejecute las migraciones pendientes.

```powershell
php artisan migrate --database=mysql_pruebas --env=testing
php artisan migrate:status --database=mysql_pruebas --env=testing
```

Compruebe las cinco claves foráneas, el índice por fecha e ID, las restricciones únicas de operación y de orden, y la conservación de los registros preexistentes. Retire los permisos temporales desde la sesión administrativa y verifique la concesión con una conexión nueva.

```sql
REVOKE CREATE, ALTER, INDEX, REFERENCES ON `masterexpress\_control\_test`.* FROM 'masterexpress_test'@'127.0.0.1';
SHOW GRANTS FOR 'masterexpress_test'@'127.0.0.1';
```

Las decisiones de [ME-E1A](ME-E1A.md#decisiones-abiertas) siguen abiertas.
