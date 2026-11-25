# Línea base técnica de MasterExpress Control

## Estructura vigente desde ME-A1

La aplicación web tiene una sola entrada en `apps/web/index.html` y arranca desde `apps/web/src/app/main.jsx`. Vite sirve `apps/web` y el alias `@/` apunta a `apps/web/src`. El manifiesto de npm, el lockfile, ESLint, el entorno local y la salida `dist/` conservan su ubicación en la raíz. El plugin de Base44 consulta el entorno de esa raíz antes de aplicar la raíz web de Vite.

| Origen | Destino dentro de `apps/web` |
| --- | --- |
| `index.html`, Vite, PostCSS, Tailwind, shadcn/ui y `jsconfig.json` | Raíz web |
| `src/main.jsx`, `App`, `Layout`, `pages.config`, estilos globales y `src/lib/PageNotFound.jsx` | `src/app/` |
| Inicio y consentimiento OAuth de `src/pages/` | `src/features/acceso/` |
| Paneles de Administrador y Colaborador de `src/pages/` | `src/features/paneles/` |
| Registro, consulta, exportación y papelera de graduandos | `src/features/graduandos/` |
| Componentes administrativos de eventos, precios, gastos, resumen, recomendaciones, correo, personal y reportes | `src/features/{ceremonias,ventas,finanzas,correo,personal,reportes}/` |
| Componentes transversales, shadcn/ui, hook de móvil y utilidades de `src/lib/` y `src/utils/` | `src/shared/{components,ui,hooks,lib,utils}/` |
| `src/api/` y contexto, parámetros y agentes de Base44 de `src/lib/` | `src/integrations/base44/` |
| `src/lib/emailService.js` | `src/integrations/emailjs/` |
| `src/assets/` y `public/` | `src/assets/` y `public/` |

Las rutas públicas siguen siendo `/`, `/Home`, `/AdminDashboard`, `/ColaboradorDashboard` y `/RegistroGraduando`. El consentimiento OAuth se conserva como código sin entrada en el registro de rutas. Se retiró del HTML la referencia a `/manifest.json`, cuyo archivo no existía en la base.

Base44 sigue proporcionando el SDK, la autenticación conectada, entidades, archivos, integraciones remotas y registro de navegación. Se conservan el plugin Vite, su compatibilidad legado y la configuración y los esquemas en `base44/`. El modo de demostración conserva el adaptador de entidades locales con persistencia en `localStorage`. EmailJS conserva el envío de correo existente.

Ejecute los comandos de [desarrollo y pruebas](../../README.md#desarrollo-local) desde la raíz. La comparación de ME-A1 sobre `fca7683` obtuvo los mismos 8 errores de ESLint y 415 diagnósticos de TypeScript antes y después del traslado, con equivalencia por archivo reubicado y diagnóstico.

En QA con datos ficticios, Vite sirvió ambos paneles, la navegación móvil y los recursos locales. Se comprobaron HMR de CSS y React Fast Refresh con la página abierta. Las suites de papelera, vínculo e interfaz completaron sus verificaciones. La prueba de retorno del foco con Escape presentó fallos intermitentes desde la base. La conexión remota con Base44 y el envío real de correo quedaron fuera de esta validación.

La siguiente etapa propuesta es tipar el módulo de vínculo entre ceremonias y graduandos, comenzando por los datos que consumen los selectores y la validación de pertenencia, y repetir la suite de vínculo. `apps/api/` queda como destino de la futura implementación de Laravel.

## Inventario histórico de ME-G0

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
