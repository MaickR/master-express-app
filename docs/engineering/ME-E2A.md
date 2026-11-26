# ME-E2A — Núcleo de inscripciones en Laravel

Base de implementación en `develop` — `9629d778082944cf3aed4580df80b857478a3205` (ME-E1B, PR #17).

## Contrato del ensayo

`Graduando` representa a una persona ficticia identificada por un ID interno preexistente. El nombre es descriptivo y puede repetirse. `Registro` conserva el programa académico opcional, la fecha de creación y las referencias al graduando, la ceremonia y el usuario Laravel que hizo el alta. La ceremonia determina el evento. La base protege las referencias frente al borrado físico y permite una participación por graduando y ceremonia.

| Método y ruta | Resultado |
| --- | --- |
| `POST /api/ceremonias/{ceremonia}/registros` | `201`. Recibe `operation_id` UUID, `evento_id`, `graduando_id` y `programa_academico` opcional. La sesión determina el actor. |
| `GET /api/registros` | `200`. Lista de 25 por página en orden descendente por ID. Acepta `evento_id`, `ceremonia_id` y `page`. Los filtros se intersectan dentro del ámbito del actor. |
| `GET /api/registros/{registro}` | `200` dentro del ámbito de la cuenta. `404` si el ID es inexistente o ajeno. |

La respuesta expone el ID de registro, el ID y nombre del graduando, el evento, la ceremonia, el programa y la fecha de creación. El alta valida la ceremonia contra el evento recibido y rechaza un vínculo inexistente o cruzado con `404`. Devuelve `422` ante datos inválidos, un graduando inexistente o campos ajenos al contrato, incluidos actor y datos de pago.

El mismo actor con el mismo UUID y contenido normalizado obtiene el `201` y el ID original tras volver a autorizar la operación. Cambiar el contenido para ese UUID devuelve `409`. Una clave distinta para una participación existente también devuelve `409`, incluso desde otro actor, sin devolver el registro original. Los conflictos y fallos revertidos no consumen una clave nueva. La transacción bloquea la cuenta durante el alta y protege las referencias consultadas. La restricción única arbitra altas simultáneas de actores distintos.

La Policy concede a Colaborador alta y consulta de sus propias capturas, y a Administrador consulta de todos los registros ficticios. Una cuenta con ambos roles satisface cada concesión por su rol correspondiente. La concesión requiere cuenta activa, entorno `testing` y conexión `mysql_pruebas`. La API usa sesión Laravel y protección CSRF de Sanctum. Una sesión vencida o revocada impide recuperar el registro o repetir el alta.

## Decisiones pendientes con Ernesto

- Identificador y ámbito de unicidad del graduando, aprovisionamiento, resolución de homónimos, menores, contactos compartidos y representación.
- Matriz operativa y asignaciones por institución o sede, quién puede capturar o consultar y cómo se atribuyen los históricos.
- Laravel todavía carece de un estado de disponibilidad en eventos y ceremonias. El ensayo usa programación ficticia existente. Quedan por acordar cierre y cancelación, múltiples ceremonias por evento, traslados, reinscripción, baja y restauración.
- Conciliación y retención de históricos, auditoría adicional y contratos separados de venta, recaudo y demanda. La conexión de React corresponde a ME-E2B.

## Verificación de QA

QA del 26 de noviembre de 2026. Se habilitó una instancia temporal MySQL 9.1 en loopback con un esquema nuevo `masterexpress_control_test`. La sesión administrativa de esa instancia aplicó las migraciones y sembró únicamente los roles. La cuenta ordinaria se comprobó con `SHOW GRANTS` y tuvo `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre el esquema literal. Las claves foráneas estaban activas. La instancia se apagó al terminar.

| Comprobación | Resultado |
| --- | --- |
| `php artisan migrate --database=mysql_pruebas --env=testing --seed --force` y `SHOW GRANTS` | **PASS**. La migración de inscripciones se aplicó con la cuenta administrativa de la instancia temporal. La primera verificación de la cuenta ordinaria falló por el argumento de host de PowerShell y pasó al corregirlo. |
| `composer test:mysql` | **PASS**, 39 pruebas y 875 aserciones. Incluye idempotencia, unicidad, referencias cruzadas e inexistentes, suplantación, acceso ajeno, reversión, CSRF, sesión vencida y suspensión, además de regresión de sesión y eventos. La primera ejecución falló al preparar los usuarios ficticios porque faltaba releer los valores por defecto de MySQL. |
| Concurrencia en dos procesos PHP sobre MySQL aislado | **PASS**. Se retuvo la primera transacción después del INSERT mientras arrancaba la segunda. El mismo actor y UUID devolvieron `201/201` con el mismo ID. Distintos actores y UUID para el mismo par devolvieron `201/409`. Cada par terminó con una sola fila. |
| `composer test` | **PASS**, 9 pruebas y 58 aserciones. La primera ejecución detectó que faltaba incluir las tres rutas nuevas en la lista aprobada. La primera prueba de CORS para un origen denegado se ajustó para reproducir la configuración de varios orígenes del ensayo. |
| `node tests/vinculo-ceremonias.mjs "<Chrome>"` | **PASS**, 19 comprobaciones del circuito Base44 con datos ficticios. |
| `php vendor/bin/pint --test` y `git diff --check` | **PASS**. |
| Integración visual con el nuevo backend | **NOT TESTED**. Corresponde a ME-E2B. |
