# MasterExpress Control

Aplicación web para apoyar la operación de ceremonias de grado. El frontend usa React 18, TypeScript estricto para el código TS/TSX, JSX para los módulos heredados, Vite 6 y Tailwind CSS 3. Incluye paneles de administración y colaboración, gestión de ceremonias y eventos, registro de graduandos, precios, gastos, reportes y exportación.

```text
apps/web/  Frontend, configuración web y recursos públicos
base44/    Configuración y esquemas de la integración actual
docs/      Documentación de producto e ingeniería
tests/     Pruebas de regresión
```

## Desarrollo local

Ejecute los comandos desde la raíz, con las dependencias del proyecto disponibles.

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Iniciar Vite con recarga en caliente. |
| `npm run build` | Compilar el frontend en `dist/` en la raíz del repositorio. |
| `npm run preview` | Servir la compilación localmente. |
| `npm run lint` | Ejecutar ESLint. |
| `npm run typecheck` | Comprobar en modo estricto los archivos TS y TSX bajo `apps/web/src`. |
| `npm run typecheck:legacy` | Ejecutar la revisión heredada con `checkJs` y su alcance original. |

Para probar la demostración con datos ficticios, defina `VITE_LOCAL_ADMIN_PASSWORD` y `VITE_LOCAL_COLABORADOR_PASSWORD` con contraseñas de prueba en la sesión de terminal o en `.env.development.local` en la raíz. Abra la URL de loopback que indica Vite. Use `admin` para Administrador y `xd` para Colaborador, con su contraseña de prueba respectiva. La demostración guarda las entidades en el navegador y requiere el servidor de desarrollo. Use un perfil limpio y datos ficticios.

El modo conectado requiere la configuración de Base44 por el canal autorizado. Vite sigue leyendo los archivos de entorno en la raíz del repositorio.

## Pruebas

Ejecute cada comando con la ruta al ejecutable de Chrome o Edge. Las tres suites usan datos ficticios y aíslan Base44.

```text
node tests/papelera-graduandos.mjs "<ruta al navegador>"
node tests/vinculo-ceremonias.mjs "<ruta al navegador>"
node tests/interfaz-base.mjs "<ruta al navegador>"
```

Consulte la [línea base técnica](docs/engineering/BASELINE.md), el [alcance V1](docs/product/ME-SCOPE-V1.md), los [estándares de ingeniería](docs/engineering/STANDARDS.md) y la [guía para agentes](AGENTS.md).
