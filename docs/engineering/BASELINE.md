# Línea base técnica de MasterExpress Control

## Inventario comprobado en ME-G0

| Ruta | Contenido observado |
| --- | --- |
| `package.json`, `package-lock.json` | Proyecto React 18, Vite 6, Tailwind CSS 3 y SDK de Base44. El manifiesto declara scripts de desarrollo, compilación, lint y revisión de tipos. |
| `src/App.jsx`, `src/Layout.jsx`, `src/pages.config.js`, `src/pages/` | Estructura de aplicación y navegación, inicio, consentimiento OAuth, registro de graduandos y paneles de administración y colaboración. |
| `src/components/admin/`, `src/components/colaborador/` | Gestión de eventos y graduandos, precios y gastos, resumen financiero, reportes, exportación a Excel y vistas de colaboración. |
| `src/api/`, `src/lib/` | Cliente y adaptadores de entidades, integraciones, contexto de autenticación, utilidades de caché y servicio de correo. |
| `base44/entities/`, `base44/config.jsonc` | Esquemas y configuración de Base44. Los esquemas incluyen usuarios, ceremonia, evento, graduando, personal, gastos, paquetes y configuración de correo. |
| `node_modules/`, `dist/` | Dependencias y artefactos existentes. Su presencia no verifica una compilación nueva. |
| `.gitignore` | Reglas para entorno, configuración local de Base44, dependencias, compilaciones, logs y archivos de editor. |

Los archivos de entorno y la configuración local excluida se identificaron por nombre. No se leyeron sus valores. En la raíz y el código inventariado no se identificó un backend Laravel/MySQL ni implementaciones de R2 o Resend.

## Hallazgos reportados en ME-I0

- **ESLint:** se reportaron **11 errores**. Registre los hallazgos por regla y archivo al abordar la deuda.
- **TypeScript:** se reportaron **441 diagnósticos**. El proyecto usa `checkJs`; clasifique los hallazgos por causa y alcance antes de estimar su impacto.
- Las cifras corresponden a controles distintos. Por sí solas no prueban fallas funcionales ni permiten sumar defectos. ME-G0 toma el contexto de ME-I0 suministrado para el arranque y verifica por separado las comprobaciones que ejecuta sobre el directorio.

## Controles estáticos repetidos en ME-G0

| Control | Resultado |
| --- | --- |
| ESLint en modo de solo lectura, con `--quiet --format json` | FAIL. 11 errores, salida 1. |
| TypeScript con `-p ./jsconfig.json --noEmit --pretty false` | FAIL. 441 diagnósticos, salida 2. |

No se aplicaron correcciones ni se generaron artefactos en estas comprobaciones.

## Riesgos y verificaciones pendientes

| Área | Riesgo reportado o limitación | Comprobación pendiente |
| --- | --- | --- |
| Autenticación y autorización | Hay problemas reportados. La presencia de pantallas y contexto de sesión no demuestra la aplicación efectiva de permisos. | Validar inicio, expiración y cierre de sesión y comprobar acceso a operaciones y registros por rol con datos ficticios. |
| Integridad | Hay problemas reportados. El inventario de esquemas y adaptadores no confirma las garantías de persistencia. | Validar restricciones, duplicados, relaciones, reintentos y consistencia al modificar registros. |
| Finanzas | Hay problemas reportados en cálculos. Las reglas operativas requieren validación. | Acordar casos de negocio y contrastar importes de ventas, gastos, totales y reportes con resultados esperados. |
| Aplicación e integraciones | El inventario de código no verifica disponibilidad, configuración ni comportamiento en ejecución. | Comprobar compilación limpia, flujos de navegador y conexión con servicios en un entorno autorizado. |
| Preparación para Git | Las exclusiones y el inventario son controles iniciales. | Revisar los archivos candidatos por datos personales, credenciales y configuraciones locales antes del primer staging autorizado. |

Consulte el [alcance de producto](../product/ME-SCOPE-V1.md) para las decisiones pendientes con Ernesto.
