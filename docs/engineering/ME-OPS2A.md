# ME-OPS2A · Calidad transversal y Eventos

El baseline es `1bb25970c6cc98b54062af365f86d7b0eb92f9bd`, el squash de ME-ADMIN-CORE en `develop`. El contrato de ME-OPS1A aparece resumido en [Autenticación](AUTENTICACION.md) y se conserva en las pruebas de alta y consulta. El [dominio V1](../product/ME-DOMINIO-V1.md) dejaba pendiente el ciclo de cancelación. Para esta fase el responsable aprobó cancelar solo eventos futuros, preservar sus relaciones, bloquear nuevas inscripciones y guardar el actor y el momento de cancelación.

La secuencia documentada permite usar ME-OPS2A para completar la programación administrativa. El plan operativo consultable en el repositorio está distribuido entre el alcance V1, el dominio y las notas de ME-ADMIN-CORE. El corte de consumidores heredados sigue pendiente.

## Programación

- Eventos y su indicador administrativo leen Laravel y MySQL. El portal institucional consulta el mismo evento dentro del vínculo y la sede autorizados. Su respuesta incluye el estado, con los detalles administrativos de operación restringidos al Administrador.
- `GET /api/eventos` conserva la paginación de 25 filas y admite `vista`, `estado`, `buscar`, `institucion_id`, `desde`, `hasta` y `page`. Devuelve el total filtrado y la fecha de Colombia utilizada en la consulta. El número de evento se busca por coincidencia exacta. La búsqueda de texto usa institución, lugar o nombre de ceremonia.
- `POST /api/eventos` conserva el alta atómica con sede de la institución y entre una y seis ceremonias. La fecha debe ser hoy o posterior en `America/Bogota`. Un reintento ya confirmado con el mismo identificador y contenido sigue resolviendo el alta inicial después de medianoche.
- `POST /api/eventos/{id}` admite fecha, lugar, graduandos previstos, nombre del responsable, observaciones, nombres y horas de ceremonias existentes. Una revisión desactualizada devuelve 409. La institución, la sede, la cantidad de ceremonias y su orden se conservan en el flujo de edición.
- `POST /api/eventos/{id}/cancelacion` es idempotente. Guarda actor y fecha de cancelación en MySQL y conserva ceremonias e inscripciones. Las nuevas inscripciones y la cancelación se coordinan con un bloqueo del evento. El flujo conserva los registros cancelados en el historial y permite recuperar el resultado de inscripciones ya confirmadas. Las claves foráneas mantienen la integridad referencial.
- El estado prioriza la cancelación. La fecha posterior a hoy indica «Próximo», hoy indica «En ejecución» y una fecha anterior indica «Finalizado». Son estados derivados del calendario colombiano. Las horas se registran en cada ceremonia. Las cifras de vinculación se obtienen de inscripciones reales por ceremonia y los programas provienen de esas inscripciones. El responsable, los previstos y las observaciones se registran explícitamente.
- El Administrador activo con cambio inicial de contraseña completado puede consultar y escribir. La Institución conserva su consulta por vínculo y sede. Las operaciones revalidan autorización y versión de sesión al escribir. El detalle privado se sirve con `Cache-Control: no-store`.

## Calidad y conectividad

La auditoría encontró usos de colores de superficie como texto, sobrescrituras oscuras con paletas fijas y botones con iconos sin nombre accesible. Se aplicaron los [tokens semánticos](DESIGN.md), se conservaron las fórmulas de finanzas y se reutilizaron los diálogos de confirmación. Los mensajes visibles describen la acción, los errores recuperables y la disponibilidad del módulo.

TanStack Query distingue el identificador de cada cuenta y revalida al guardar, al volver al foco o al reconectar. El módulo conserva temporalmente las vistas que siguen abiertas y requiere conexión para escribir. El [contrato PWA](../product/ME-PWA.md) mantiene en fases posteriores la instalación, Service Worker, IndexedDB, los borradores persistentes y la sincronización para Vendedor.

## Aceptación y dependencias

`2026_11_28_000012_completar_programacion_operativa` agrega columnas anulables y una revisión inicial a la programación existente. En MySQL aislado de pruebas la concesión se mantiene disponible después de migrar. Fuera del ensayo, la activación explícita requiere `ME_EVENTOS_HABILITADOS=true` y el esquema actualizado. Mientras falte el esquema, el módulo administrativo devuelve una indisponibilidad controlada para el Administrador, y la sesión y las demás vistas siguen su flujo habitual.

Los módulos heredados de reportes, registros, exportación y correos conservan sus consultas anteriores. La conciliación de sus referencias con el catálogo operativo de Laravel queda pendiente antes de cortar esos consumidores. La fase tampoco cubre edición histórica especial, trazabilidad de cada edición, reactivación de cancelados, cambios de sede, auditoría financiera, precios negativos ni regresión OTP/Resend.

## Verificación

El ejecutor focalizado es `node tests/qa-admin-core.mjs --eventos --servir --automatizado --chrome`. Abre una instancia MySQL nueva en el puerto 3338, separada de aceptación. La evidencia se guarda fuera del árbol de Git en la carpeta temporal indicada por el ejecutor.

| Comprobación | Resultado |
| --- | --- |
| PHPUnit focalizado sobre MySQL | **PASS** · 26 pruebas y 572 aserciones. Fecha y límite de medianoche de Colombia, sesión, CSRF del alta, integridad, cambios simultáneos mediante revisión, cancelación, reinscripción, paginación y ámbitos institucionales. |
| Chrome | **PASS** · Alta y edición en Laravel, recarga, filtros combinados, detalle, confirmación, cancelación en historial y recuperación ante error. Teclado, devolución del foco y navegación táctil emulada. |
| Responsive y contraste | **PASS** · 96 combinaciones de Pantalla Principal, Eventos, Gastos y Resumen Financiero a 320, 390, 425, 768, 1024 y 1440 px en Claro, Oscuro y Sistema con ambas preferencias del dispositivo. Sin desbordamiento horizontal. Mínimo de texto medido de 4,90:1. Los pares seleccionados para iconos, bordes de controles y foco superaron 3:1. |
| Conectividad | **PASS** · Chrome mostró pérdida de conexión, deshabilitó escrituras, revalidó al reconectar y ante el evento de visibilidad. La comprobación encontró cero registros de Service Worker y cero cachés públicas. |
| Typecheck, compilación, ESLint focalizado, Pint y diff | **PASS** · Vite informó el aviso de configuración de la integración heredada de Base44 y avisos de antigüedad de sus datos de compatibilidad. La compilación terminó correctamente. |
| Entorno persistente | **PASS** · Web en 5188 y salud de la API en 8008 respondieron HTTP 200. **BLOCKED** para habilitar la programación sobre el esquema de aceptación hasta que se autorice aplicar la migración. |
| Alcance fuera del ensayo | **NOT TESTED** · Dispositivos físicos, evaluación completa WCAG del producto, capacidades PWA pendientes, OTP, Resend, conciliación financiera y activación sobre datos de aceptación. |

La primera corrida MySQL detectó que una búsqueda numérica incluía nombres de ceremonias con ese número. Se cambió a coincidencia exacta del identificador y se volvió a ejecutar la prueba. En Chrome se ajustó la automatización para esperar la apertura del menú y del panel móvil, medir consultas de red completadas y emitir el evento de visibilidad sobre la ventana. El cálculo de contraste compone las capas semitransparentes de los botones antes de comparar luminancias.

La medición utiliza un umbral de contraste de 4,5:1 para todas las muestras de texto seleccionadas. El control de detalle se ensayó con toque emulado y una altura de al menos 44 píxeles CSS. [Contraste mínimo de WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Área interactiva mínima de WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
