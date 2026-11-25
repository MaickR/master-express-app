# MasterExpress Control

Aplicación web para apoyar la operación de ceremonias de grado. El frontend usa React 18, TypeScript estricto para el código TS/TSX, JSX para los módulos heredados, Vite 6 y Tailwind CSS 3. Incluye paneles de administración y colaboración, gestión de ceremonias y eventos, registro de graduandos, precios, gastos, reportes y exportación.

```text
apps/web/  Frontend, configuración web y recursos públicos
apps/api/  Backend Laravel y pruebas de la API
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

### Backend Laravel

La base se verificó con Laravel 13.44.1, PHP 8.3.14 y Composer 2.8.4. Desde la raíz, en PowerShell:

```powershell
Set-Location apps/api
composer install
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    php artisan key:generate
}
php artisan serve --host=127.0.0.1 --port=8000
```

Si Composer informa que falta soporte para descomprimir paquetes en Windows, use una herramienta de extracción ya disponible o cargue la extensión ZIP de PHP para esa ejecución. Con Composer Setup y `php_zip.dll` disponibles, el equivalente es `php -d extension=zip (Join-Path (Split-Path (Get-Command composer.bat).Source) 'composer.phar') install`.

Desde otra terminal, ejecute `curl.exe -i http://127.0.0.1:8000/api/salud`. La respuesta esperada es HTTP 200 con `{"estado":"correcto","servicio":"masterexpress-api"}`. La ruta verifica que Laravel responde. El servidor se inicia con `APP_DEBUG=false` en la plantilla y la API aún no autoriza orígenes cruzados.

El entorno de desarrollo usa `masterexpress_control_dev` en MySQL local. En `apps/api/.env`, configure `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT`, `DB_DATABASE=masterexpress_control_dev`, `DB_USERNAME` y `DB_PASSWORD`. Guarde las credenciales locales únicamente en el entorno excluido de Git. La instalación con Composer y la ruta de salud funcionan sin MySQL. React conserva su integración con Base44.

Para preparar una instalación nueva, un aprovisionador autorizado verifica que los dos esquemas estén libres, los crea y asigna cuentas locales distintas con permisos por esquema. Aplique las migraciones desde `apps/api/` con permisos DDL temporales y solo tras confirmar servidor y esquema. Retire esos permisos al finalizar.

```powershell
php artisan migrate --database=mysql --env=local --seed
php artisan migrate --database=mysql_pruebas --env=testing --seed
```

## Pruebas

Desde `apps/api/`, ejecute `composer test` para las pruebas sin SQL. Para la integración use `composer test:mysql` con `masterexpress_control_test` ya migrada y reservada para QA. En el archivo local excluido `apps/api/.env.testing`, configure `APP_ENV=testing`, `APP_DEBUG=false`, `DB_CONNECTION=mysql_pruebas`, `ME_MYSQL_TEST_PORT`, `ME_MYSQL_TEST_USERNAME` y `ME_MYSQL_TEST_PASSWORD`. La conexión de pruebas apunta a `127.0.0.1` y usa una cuenta distinta de desarrollo. Las pruebas verifican el esquema, sus tablas transaccionales y la falta de acceso a desarrollo antes de abrir una transacción. Cada caso revierte sus cambios ficticios.

Consulte el [contrato de identidad y roles](docs/engineering/IDENTIDAD.md) para las reglas de asignación y los pendientes de ME-AUTH1.

Ejecute cada comando con la ruta al ejecutable de Chrome o Edge. Las tres suites usan datos ficticios y aíslan Base44.

```text
node tests/papelera-graduandos.mjs "<ruta al navegador>"
node tests/vinculo-ceremonias.mjs "<ruta al navegador>"
node tests/interfaz-base.mjs "<ruta al navegador>"
```

Consulte la [línea base técnica](docs/engineering/BASELINE.md), el [alcance V1](docs/product/ME-SCOPE-V1.md), los [estándares de ingeniería](docs/engineering/STANDARDS.md) y la [guía para agentes](AGENTS.md).
