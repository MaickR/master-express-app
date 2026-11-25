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

MySQL es el motor objetivo. Cuando haya una base local aislada y autorizada, configure `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` y `DB_PASSWORD` en `apps/api/.env`, y mantenga `DB_CONNECTION=mysql`. La salud y las pruebas básicas funcionan sin credenciales. El servicio local MySQL está activo y su conexión desde Laravel queda pendiente. La instalación no ejecuta migraciones. React conserva su integración actual con Base44. La conexión React–Laravel, la autenticación empresarial y los modelos Eloquent de negocio quedan para fases posteriores.

## Pruebas

Para el backend, ejecute `composer test` desde `apps/api/`. La suite fuerza el entorno `testing`, usa servicios locales en memoria y configura SQLite en memoria como destino aislado. Las pruebas actuales no abren una conexión SQL y funcionan con `pdo_sqlite` desactivado. La validación de la conexión y las migraciones en MySQL corresponde a una base autorizada en ME-D0.

Ejecute cada comando con la ruta al ejecutable de Chrome o Edge. Las tres suites usan datos ficticios y aíslan Base44.

```text
node tests/papelera-graduandos.mjs "<ruta al navegador>"
node tests/vinculo-ceremonias.mjs "<ruta al navegador>"
node tests/interfaz-base.mjs "<ruta al navegador>"
```

Consulte la [línea base técnica](docs/engineering/BASELINE.md), el [alcance V1](docs/product/ME-SCOPE-V1.md), los [estándares de ingeniería](docs/engineering/STANDARDS.md) y la [guía para agentes](AGENTS.md).
