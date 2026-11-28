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
| Entorno persistente | **PASS** · Web en 5188 y salud de la API en 8008 respondieron HTTP 200. La habilitación posterior de la programación se documenta en el cierre de aceptación. |
| Alcance fuera del ensayo | **NOT TESTED** · Dispositivos físicos, evaluación completa WCAG del producto, capacidades PWA pendientes, OTP, Resend y conciliación financiera. |

La primera corrida MySQL detectó que una búsqueda numérica incluía nombres de ceremonias con ese número. Se cambió a coincidencia exacta del identificador y se volvió a ejecutar la prueba. En Chrome se ajustó la automatización para esperar la apertura del menú y del panel móvil, medir consultas de red completadas y emitir el evento de visibilidad sobre la ventana. El cálculo de contraste compone las capas semitransparentes de los botones antes de comparar luminancias.

La medición utiliza un umbral de contraste de 4,5:1 para todas las muestras de texto seleccionadas. El control de detalle se ensayó con toque emulado y una altura de al menos 44 píxeles CSS. [Contraste mínimo de WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Área interactiva mínima de WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## Cierre de aceptación · 28 de noviembre de 2026

La verificación se hizo sobre el esquema persistente `masterexpress_control_test` en MySQL 3328, con frontend 5188 y API 8008. El primer intento de comprobación encontró MySQL detenido. Se levantó con el directorio registrado y se verificaron la conexión, las claves foráneas y la identidad principal antes de migrar.

| Comprobación | Resultado |
| --- | --- |
| Respaldo privado | **PASS** · Volcado transaccional cifrado con DPAPI para el usuario local y guardado fuera de Git. Se verificó el descifrado y se restauró en MySQL aislado 3338. Las huellas de las tablas verificadas y los conteos coincidieron. Se retiró el clon temporal. SHA-256 del archivo cifrado `CCC27096EC2C5A0990A0FC5593BF2CFDEF8F951393D63274E988E802D8867598`. |
| Migración | **PASS** · `php artisan migrate --database=mysql_pruebas --path=database/migrations/2026_11_28_000012_completar_programacion_operativa.php --force`. El registro de Laravel confirmó una sola migración nueva. Las columnas quedaron con los valores iniciales previstos y se verificó la clave foránea del actor de cancelación. |
| Registros previos | **PASS** · Coincidieron las huellas antes y después. Se conservaron las 11 cuentas, sus credenciales, roles y auditoría. La cuenta principal 27 mantuvo su estado activo, su rol de Administrador y su protección. El esquema partió sin eventos, ceremonias ni inscripciones. |
| Disponibilidad | **PASS** · Web 5188 y salud de API 8008 respondieron HTTP 200. Eventos devolvió 401 sin sesión y funcionó desde el panel con la sesión autenticada existente. El Panel Principal mostró el indicador de Eventos activos y se confirmó la ausencia del aviso técnico sobre Base44. |
| Gestión y fechas | **PASS** · El formulario rechazó una fecha pasada, creó un evento futuro, abrió su detalle y guardó la edición, incluidos los 18 graduandos previstos y la hora 09:15 de la primera ceremonia. La recarga conservó los cambios. En Laravel se comprobó el rechazo de una fecha inválida y pasada, y la aceptación de la fecha operativa de Bogotá dentro de una transacción revertida. |
| Cancelación e integridad | **PASS** · El evento sintético 1 salió de la programación activa y quedó en Historial con fecha y actor de cancelación, dos ceremonias y una inscripción sintética. El detalle mostró el programa y el vínculo. MySQL confirmó la persistencia de los mismos identificadores. |
| Nueva inscripción después de cancelar | **NOT TESTED** en aceptación porque no había un Colaborador activo. El bloqueo HTTP 409 está cubierto por el QA aislado de ME-OPS2A. La inscripción de aceptación se agregó como dato sintético para comprobar su conservación. |

Quedó en aceptación un único evento de QA cancelado, identificado como ficticio, con su catálogo mínimo y sus relaciones de prueba. Se conservaron las credenciales existentes. El cierre no requirió seeders, PHPUnit ni cambios en el código de aplicación. Los comprobantes `resultado-migracion.json` y `resultado-qa.json` quedaron en el directorio local privado `MasterExpress/ops2a-cierre-20261128-071449`, bajo `LOCALAPPDATA`. **GO para PR**.
