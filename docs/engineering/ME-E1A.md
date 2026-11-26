# ME-E1A — Eventos y ceremonias en Laravel

Base de implementación en `develop` — `5efe91520b0fbd1e85d83ccaed0f251016ef7c56` (ME-E0, PR #15).

## Compatibilidad con Base44

`GestionEventos.jsx` conserva el listado, el alta de eventos activos con ceremonias iniciales y el borrado heredado mediante el cliente Base44. El ensayo de Laravel conserva fecha, lugar opcional y ceremonias numeradas en orden consecutivo. El selector heredado de una a seis ceremonias se usa como rango del ensayo. La aprobación del rango operativo sigue pendiente.

Laravel da a la institución un ID independiente del nombre y tipo. El lugar sigue siendo texto libre. El alta y sus ceremonias se guardan en una transacción, y el conteo se obtiene de la relación. Base44 sigue siendo la fuente de la operación real. La conexión de React y el corte de escrituras se harán en su fase correspondiente.

## API de ensayo

Las rutas usan la sesión web de Laravel y la protección CSRF de Sanctum para solicitudes de la SPA. La Policy concede el ensayo a cuentas activas de Administrador únicamente en el entorno `testing` y con la conexión aislada `mysql_pruebas`. En los demás entornos las cuentas autenticadas reciben `403`. Esta concesión de QA usa instituciones ficticias creadas por las pruebas.

| Método y ruta | Resultado |
| --- | --- |
| `GET /api/eventos` | `200`. Lista de 25 por página, ordenada por fecha e ID descendentes. Acepta `institucion_id` y `page`. |
| `POST /api/eventos` | `201`. Recibe `institucion_id`, `fecha` (`AAAA-MM-DD`), `lugar` opcional, `numero_ceremonias` y `operation_id` UUID. Devuelve el evento con sus ceremonias. |
| `GET /api/eventos/{evento}` | `200`. Detalle con institución, conteo y ceremonias ordenadas. |
| `GET /api/eventos/{evento}/ceremonias` | `200`. Lista ordenada de ceremonias del evento. |
| `GET /api/eventos/{evento}/ceremonias/{ceremonia}` | `200`. Detalle de una ceremonia que pertenece al evento indicado. |

Las respuestas exitosas usan `data`. El listado incluye los enlaces de paginación. Los errores usan `message` y la validación añade `errors`. La API devuelve `401` sin sesión vigente, `403` sin permiso, `404` si falta el recurso de consulta o la ceremonia pertenece a otro evento, `409` ante una clave reutilizada con otra solicitud, `419` sin protección CSRF donde aplica y `422` para campos inválidos o una institución inexistente en el alta.

El alta obtiene el actor de la sesión y lo vuelve a comprobar dentro de la transacción. La clave única se limita al actor y al tipo de operación de alta de eventos. El mismo UUID y contenido normalizado recuperan el `201` y los IDs originales tras volver a autorizar la solicitud. La base conserva el UUID, la huella, el actor y el resultado juntos. Las referencias impiden dejar huérfanos por eliminación física.

## Decisiones abiertas

- Acordar el identificador oficial, las equivalencias históricas, el aprovisionamiento de instituciones y las reglas de sedes.
- Aprobar el ámbito y las acciones por rol, la administración de vínculos, la política para históricos y los permisos de exportaciones y adjuntos.
- Acordar cantidad de ceremonias, fechas múltiples, huso horario, responsables y reglas de rectificación, disponibilidad y retiro.
- Resolver los contratos de personas, participación, venta, pago y demanda, y la conciliación, auditoría, retención, corte y reversión de datos reales según [ME-E0](../product/ME-DOMINIO-V1.md#13-decisiones-confirmadas-y-pendientes-con-ernesto).
