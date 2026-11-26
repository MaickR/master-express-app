# Contrato PWA de MasterExpress Control

La primera entrega cubre instalación y trabajo desconectado acotado del rol Vendedor. La matriz de permisos y el vínculo comercial en servidor siguen sujetos al [alcance V1](ME-SCOPE-V1.md). Este contrato define requisitos de aceptación. Su publicación no habilita roles, operaciones ni almacenamiento local.

## Estado al cierre de ME-UI2C

| Estado | Capacidad |
| --- | --- |
| **IMPLEMENTADO** | La aplicación web responsive usa un logotipo local, tema persistente y sesión Laravel para Administrador y Colaborador. La entrada HTML incluye icono y metadatos móviles. Vite compila y sirve el frontend. |
| **DISEÑADO** | Instalación, consulta acotada de datos previamente sincronizados para Vendedor, borradores de ventas y recibos, cola privada, validación en servidor y resolución de conflictos. |
| **PENDIENTE** | Manifest enlazado e iconos de instalación, Service Worker y su registro, política de caché, instalación comprobada, IndexedDB operativo, endpoints Laravel idempotentes, sincronización y pruebas en dispositivos. |

La revisión de la entrada HTML, el código y la configuración de Vite encontró que actualmente faltan el manifest, el Service Worker y un mecanismo offline de la aplicación. El almacenamiento de demostración de Base44 usa datos ficticios del navegador y queda fuera del flujo PWA. La autenticación vigente y los roles habilitados se describen en el [contrato de sesión](../engineering/AUTENTICACION.md).

## Instalación y consulta acotada

- Entregar por HTTPS e incluir un manifest válido con identidad estable, URL de inicio, alcance, modo de presentación e iconos adecuados. Verificar instalación y apertura desde el sistema operativo en Android e iOS.
- Vendedor podrá consultar únicamente el subconjunto que el servidor autorizó y que el dispositivo sincronizó previamente. Mostrar fecha de actualización, estado de conexión y aviso cuando falte una copia o esté vencida.
- Diseñar y revisar el Service Worker antes de activarlo. Cachear únicamente recursos públicos de la interfaz mediante una lista explícita y versionada. Excluir de Cache Storage todas las respuestas autenticadas. El uso offline se limita a los campos autorizados y borradores guardados en IndexedDB. Las galerías privadas requieren conexión.

## Borradores, cola y sincronización

- Guardar borradores de venta y recibos provisionales en IndexedDB, con separación por identidad y dispositivo o instalación. Los borradores deben identificarse como pendientes y sobrevivir a un reinicio de la app dentro de la política de retención aprobada.
- Cada envío genera un `operation_id` UUID estable para todos sus reintentos. Laravel valida la sesión y los permisos vigentes, aplica una restricción única en el ámbito de la operación y registra el resultado junto con el cambio dentro de una transacción. Un reintento con el mismo contenido recupera el resultado original. Si el identificador llega con datos distintos, la API devuelve un conflicto.
- Validar en Laravel precios vigentes, permisos y pertenencia de los datos, importes, referencias y comprobantes del recibo. Los cambios de precio o permisos, duplicados y datos inconsistentes requieren resolución explícita.
- Un pago capturado offline es provisional. El estado confirmado y el recibo definitivo requieren aceptación del servidor.
- Mostrar estados visibles de **borrador**, **pendiente**, **sincronizando**, **sincronizado**, **error recuperable** y **conflicto**, con una acción clara para los estados que requieren intervención.
- Reintentar al reconectar o al volver a abrir la aplicación con sesión válida. Ofrecer **Sincronizar ahora**, con reintentos acotados y sin enviar en paralelo la misma operación. Background Sync es una optimización cuando el navegador la ofrece. La sincronización manual y en primer plano cubre su ausencia.

## Protección de datos y aceptación

- Guardar solo los datos operativos imprescindibles, con vencimiento y limpieza explícitos. Evitar credenciales, tokens de sesión o copias amplias de información privada en la cola local.
- Al cerrar sesión o cambiar de usuario, aislar de inmediato las copias y borradores de esa identidad y aplicar la política de eliminación. La decisión de conservar borradores sin sincronizar requiere una política aprobada de retención y recuperación. Si expira la sesión, detener los envíos y exigir autenticación para reanudarlos.
- Revisar el comportamiento en equipos compartidos, pérdida de dispositivo, limpieza de datos del navegador y cambios de permisos. IndexedDB conserva datos operativos autorizados y Laravel sigue siendo la autoridad de sesión, permisos y confirmaciones.
- Probar en dispositivos reales con Chrome en Android y Safari en iOS. Cubrir instalación, apertura, red intermitente, reinicio, sincronización manual, reenvío idempotente, conflictos, cierre y cambio de cuenta, pagos provisionales y ausencia de galerías privadas offline.

Referencias técnicas para la fase de implementación. [Web App Manifest](https://www.w3.org/TR/appmanifest/) · [Background Sync](https://wicg.github.io/background-sync/)
