# Base44 App

## MasterExpress Control

Aplicación web para apoyar la operación de ceremonias de grado. La base actual es una exportación de Base44 con React 18, Vite 6, Tailwind CSS 3 y el SDK de Base44.

El código incluye registro de graduandos, paneles de administración y colaboración, gestión de ceremonias y eventos, ventas, gastos, reportes y exportación. Esta línea base registra el código disponible y los riesgos de autenticación, integridad de datos y cálculos financieros pendientes de validar y resolver.

En el proyecto inspeccionado no hay un backend Laravel/MySQL ni implementaciones de R2 o Resend. La conexión con Base44 depende del entorno. Mantenga los archivos de entorno fuera de Git y solicite por un canal autorizado la configuración local que corresponda.

### Comandos existentes

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Iniciar el servidor de desarrollo con las dependencias y la configuración local ya disponibles. |
| `npm run build` | Generar la compilación en `dist/`. |
| `npm run lint` | Ejecutar ESLint con la configuración actual. |
| `npm run typecheck -- --noEmit` | Revisar diagnósticos de TypeScript sin emitir archivos. |

La [línea base técnica](docs/engineering/BASELINE.md) recoge las comprobaciones y sus límites. Consulte el [alcance V1](docs/product/ME-SCOPE-V1.md), los [estándares de ingeniería](docs/engineering/STANDARDS.md) y la [guía para agentes](AGENTS.md).
