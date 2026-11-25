# Línea base técnica de MasterExpress Control

## MySQL e identidad central desde ME-D0

**Implementado.** Laravel usa una identidad central en `users`. `roles` almacena los siete códigos aprobados y `rol_user` registra las asignaciones con una clave primaria compuesta y dos claves foráneas. El seeder del catálogo es idempotente. La API pública sigue sirviendo la ruta de salud.

Se crearon y migraron `masterexpress_control_dev` y `masterexpress_control_test` en MySQL 9.1.0 local con cuentas separadas. Los permisos DDL se retiraron después de migrar. Las pruebas de integración verifican la conexión y el aislamiento de la base de pruebas, y revierten los cambios ficticios en transacciones. Consulte los [comandos de pruebas](../../README.md#pruebas).

**Pendiente.** ME-AUTH1 debe establecer el mecanismo de acceso y la gestión de sesiones. La autorización por operación y por ámbito requiere Policies y relaciones de dominio aprobadas. Consulte el [contrato de identidad](IDENTIDAD.md).

## Fundamento Laravel desde ME-L0R

`apps/api/` contiene Laravel 13.44.1, instalado con PHP 8.3.14 y Composer 2.8.4. `composer.lock` fija las dependencias. El arranque registra `routes/api.php` con el prefijo oficial `/api`. `GET /api/salud` devuelve HTTP 200 en JSON. La API negocia sus errores como JSON y el entorno local recomendado mantiene la depuración desactivada y CORS cerrado.

El esqueleto conserva Eloquent y las migraciones iniciales de Laravel. Composer instala las dependencias sin ejecutar migraciones. Las pruebas básicas de salud y exposición de la API usan el entorno `testing` con un destino SQLite en memoria y no abren conexiones SQL.

El frontend sigue usando Base44. La conexión de React con Laravel, los modelos de negocio, las sesiones empresariales, Form Requests y Policies quedan para fases posteriores. Consulte los [comandos de desarrollo](../../README.md#backend-laravel).

## Fundamento TypeScript desde ME-TS1

La entrada es `apps/web/src/app/main.tsx`. Se migraron la composición de React y del router (`App.tsx`), el registro de páginas (`pages.config.ts`), el cliente compartido de TanStack Query (`query-client.ts`), el combinador de clases (`utils.ts`) y el panel desplegable de navegación móvil (`sheet.tsx`). Cada archivo migrado reemplaza su equivalente JS o JSX. El Layout conserva JSX con su contrato de props en JSDoc, que también usa el router.

`apps/web/tsconfig.json` hereda los alias y la resolución para Vite de `jsconfig.json`. Usa TypeScript estricto sin emitir código y permite importar JS/JSX. Vite conserva la transpilación y el plugin de React. `npm run typecheck` cubre todo TS/TSX bajo `src`. `npm run typecheck:legacy` conserva la revisión `checkJs` anterior con 415 diagnósticos idénticos a la base `b26a865`. ESLint conserva sus 8 errores heredados en los mismos archivos y ubicaciones.

Hay 7 archivos TS/TSX de 92 archivos fuente JS, JSX, TS o TSX bajo `apps/web/src`. Seis corresponden a ME-TS1 y uno ya era TypeScript. Vite inició y compiló en una copia aislada con configuración ficticia. HMR actualizó CSS y Fast Refresh aplicó un cambio de `App.tsx` conservando el formulario y su valor en Chrome. Las suites de papelera y vínculo pasaron con datos ficticios. La suite de interfaz pasó completa en Edge. Chrome reprodujo el fallo heredado de retorno del foco con Escape, tanto en la base como con ME-TS1.

Para ME-TS2 quedan el tipado del proveedor y los adaptadores de Base44, el Layout, los hooks y los componentes de panel que siguen en JSX, y el vínculo de ceremonias con graduandos. El router consume un contrato acotado del proveedor heredado. Las pruebas de ME-TS1 cubren la demostración aislada y las funciones simuladas de Base44 y correo.

## Estructura vigente desde ME-A1

ME-A1 estableció una sola entrada HTML en `apps/web/index.html`. Vite sirve `apps/web` y el alias `@/` apunta a `apps/web/src`. El manifiesto de npm, el lockfile, ESLint, el entorno local y la salida `dist/` conservan su ubicación en la raíz. El plugin de Base44 consulta el entorno de esa raíz antes de aplicar la raíz web de Vite.

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

La siguiente etapa propuesta para el frontend es tipar el módulo de vínculo entre ceremonias y graduandos, comenzando por los datos que consumen los selectores y la validación de pertenencia, y repetir la suite de vínculo.

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
