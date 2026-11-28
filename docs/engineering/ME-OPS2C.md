# ME-OPS2C · Gestión de graduandos e inscripciones

## Preflight y decisiones aprobadas

28 de noviembre de 2026. Base `origin/develop` actualizada: `f065883`. Worktree independiente `C:/Users/Mike/Documents/Development/master-express-ops2c`, rama `feat/gestion-graduandos`. La aceptación continúa en `C:/Users/Mike/Documents/Development/master-express-app`, rama `feat/catalogo-paquetes`, con sus cambios locales de ME-OPS2B. No se cambió esa rama ni se publicaron sus archivos. No se usaron stash, reset, clean, PR, merge ni deploy.

**PASS · Punto de control de aislamiento.** Las rutas escribibles son los archivos de graduandos, inscripciones, vinculación y sus consumidores en `apps/api/app`, `apps/api/routes/api.php`, `apps/api/bootstrap/app.php`, `apps/api/config`, la migración 000014, sus pruebas; los consumidores correspondientes en `apps/web/src`, la configuración de caché de Vite, los ejecutores focalizados en `tests` y este documento. El resto permanece fuera de la implementación. Las dependencias instaladas existentes se reutilizaron; no se cambiaron manifiestos ni lockfiles. Entornos y respaldos quedan fuera de Git. No se leyeron valores de archivos de entorno.

Las notas ME-E2A y ME-DOMINIO-V1 dejaban abiertas identidad y ámbito. El responsable aprobó expresamente en esta fase:

- ID interno como identidad canónica del graduando operativo; documento opcional CC/TI, conservado como texto, y contacto propio del perfil. Documento repetido rechazado, sin fusionar personas. Homónimos permitidos con revisión explícita.
- Colaborador: solo perfiles creados por su cuenta y sus propias inscripciones. Administrador: todos los perfiles y las inscripciones. Institución: lectura de participaciones de su institución y sede verificadas. Graduando: lectura mediante vínculo activo con su cuenta.

Estas decisiones sustituyen esas limitaciones específicas del ensayo. No resuelven reglas comerciales, representación por terceros, traslado de inscripciones, migración Base44 ni cierre de ceremonias independiente del evento.

## Contratos y autoridad

`Graduando` es el perfil operativo. `User` es una cuenta de acceso y conserva identidad, documento de cuenta, credenciales y roles. `VinculoGraduando` otorga acceso explícito por IDs, con sus acciones, historial y auditoría existentes. No se crea una cuenta al registrar una persona ni se copia automáticamente información entre ambas. Nombre, correo y teléfono coincidentes no consolidan personas ni conceden acceso.

`Registro` es una participación en una ceremonia; la ceremonia determina evento, institución y sede. La pertenencia institucional se consulta a través de esa inscripción, sin un modelo ni un estado comercial paralelo. Una misma persona puede tener participaciones distintas. Los históricos con actor de creación desconocido conservan `creado_por = null`: no se atribuyen automáticamente a un Colaborador. El Administrador puede revisarlos.

| Método y ruta | Contrato |
| --- | --- |
| `GET /api/graduandos` | Paginación Laravel de 25, total y `hayMas`. Búsqueda por nombre, documento exacto o correo; filtros `institucion_id`, `sede_id`, `evento_id`, `ceremonia_id`, `vinculacion=activa|sin_vinculo`, `page`. Todos intersectan el ámbito del actor; los filtros de programación deben coincidir en la misma inscripción autorizada. |
| `POST /api/graduandos` | Nombre requerido; tipo y número de documento opcionales juntos; correo y teléfono opcionales; `operation_id` UUID requerido. `201` al crear o recuperar un reintento idéntico. |
| `GET /api/graduandos/{id}` | Detalle permitido, revisión y capacidad de edición. ID ajeno: `404`. No expone huellas ni atributos de autenticación. |
| `POST /api/graduandos/{id}` | Campos del perfil y `revision` requerida. Revisión obsoleta o documento en uso: `409`. No permite cambiar actor, cuenta, inscripción ni identificador de operación. |
| `GET /api/graduandos/filtros` | Opciones de programación derivadas de las inscripciones autorizadas. No entrega catálogos de otra institución para eludir su ámbito. |
| `GET /api/graduandos/programacion` | Programación no cancelada, paginada, solo para quienes pueden inscribir. No inventa cierres por fecha ni estados independientes de ceremonia. |
| `POST /api/ceremonias/{id}/registros` | Reutiliza `InscribirGraduando`, UUID, transacción, autorización vigente, bloqueo de evento, unicidad persona/ceremonia e idempotencia actor/operación. |
| `GET /api/registros` y `/{id}` | Consultas existentes con los ámbitos aprobados; agrega `graduando_id` a los filtros existentes. Los registros institucionales se filtran por su propio evento y sede, incluso cuando la persona participa también en otra institución. |
| `/api/administracion/vinculos-graduandos/*` | Reutiliza vinculación, corrección, anulación, confirmaciones y auditoría. Agrega búsqueda en Laravel y estado real de vínculo activo en el listado. No amplía sus mutaciones a otros roles. |

El documento se valida como cadena de dígitos y conserva ceros iniciales. La unicidad es el par tipo/número; no se afirma una verificación oficial del documento. El correo se recorta y pasa a minúsculas; no es una clave de identidad personal. Teléfono: cadena de 7 a 15 dígitos. Las entradas ajenas al contrato de escritura se rechazan con `422`. Sin documento se permite un perfil independiente y se exige revisión humana antes de guardar en la interfaz; no existe una regla fiable para deduplicar por nombre o contacto.

El alta bloquea la cuenta, revalida estado/versión/permisos y guarda operación y huella dentro de la transacción. La restricción única arbitra documentos concurrentes entre actores. Una edición bloquea el perfil y compara revisión para evitar sobrescrituras. No existe borrado HTTP de perfiles o inscripciones. Las claves foráneas conservan referencias. La inscripción nueva rechaza eventos cancelados con `409`; un reintento previamente confirmado puede recuperar su resultado después de cancelar. La ceremonia no tiene estado de cancelación independiente en el modelo aprobado.

## Interfaz y consultas

Registros de Graduandos del Administrador, las rutas del Colaborador y las consultas de Graduando e Institución consumen la misma gestión compartida y Laravel. Se conserva el marco `PanelOperativo`, los temas, la navegación y los diálogos Radix existentes. El indicador de graduandos del Administrador consulta el total autoritativo. El registro comercial heredado permanece en su archivo, separado de estas rutas; no se incorpora venta, paquete, recibo ni correo transaccional al alta operativa.

TanStack Query incluye la identidad en las claves, invalida perfiles/vinculaciones/programación después de escribir y revalida al foco o reconexión. El proveedor de sesión existente limpia las consultas al salir o cambiar de cuenta. Las respuestas privadas llevan `Cache-Control: no-store`; el cliente usa `cache: no-store`. Se muestran carga, vacío, error recuperable, desactualización sin conexión y estado accesible de escritura. Los errores de validación se asocian a sus campos y reciben foco. Se conserva el formulario ante errores.

El origen pertinente es `base44/entities/Graduando.jsonc`: mezcla persona, ceremonia, programa, paquete, pago y papelera. `RegistroGraduando.jsx` consulta Evento/Ceremonia/Configuracion, crea esa fila y solicita el correo; `TodosRegistros.jsx` y `ColaboradorDashboard.jsx` conservan consultas y suscripciones a esas entidades. Sus rutas operativas se sustituyen por el consumidor compartido Laravel sin convertir IDs de texto del origen a IDs internos ni importar sus datos comerciales.

Los reportes, exportaciones, papelera y métricas financieras heredados conservan sus fuentes anteriores; esta fase no concilia sus IDs de Base44 ni certifica esos consumidores como parte de la operación Laravel. No se habilitan Finanzas, Vendedor, Producción, Fotografías, notificaciones ni OTP/Resend.

## PWA

**PASS · Alcance acotado.** Se conserva solamente la información ya autorizada que permanece abierta en memoria. Las escrituras requieren conexión y aceptación del servidor. Los UUID permiten reintentos del mismo contenido, sin una cola offline paralela. **NOT TESTED / pendiente de fases PWA:** instalación, Service Worker, IndexedDB, borradores persistentes, sincronización en segundo plano y dispositivos físicos. No se declara soporte offline persistente para esta gestión.

## Migración e integración

Archivo nuevo exacto: `apps/api/database/migrations/2026_11_28_000014_completar_graduandos_operativos.php`. Es aditivo: columnas anulables de documento/contacto/actor/operación/huella y revisión inicial 1; índices únicos de documento y operación, y referencia restringida al actor. Los registros anteriores conservan ID, nombre, relaciones y atribución desconocida. No se importan datos Base44 ni se alteran cuentas o contraseñas.

La numeración 000014 evita colisionar con la migración 000013 local de ME-OPS2B. No existe dependencia funcional indispensable de Paquetes. La conciliación Base44 de ME-OPS2B permanece **BLOCKED** y fuera de esta fase. Hay consumidores compartidos en `AdminDashboard.jsx`, rutas y CORS que deberán revisarse al integrar ambas ramas; este worktree no incorpora la versión local de esos archivos ni publica el trabajo de Paquetes.

**PASS · Ensayo de migración y respaldo.** El ejecutor crea MySQL nuevo en 3338, aplica primero las migraciones anteriores a 000014, crea un perfil ficticio previo, genera un volcado transaccional fuera de Git y lo restaura en `masterexpress_respaldo_ops2c` de esa misma instancia aislada. Compara el perfil restaurado, aplica 000014 en el esquema de ensayo y comprueba ID/nombre/revisión y documento/actor nulos. Solo retira ese fixture sintético del esquema temporal antes de PHPUnit.

Procedimiento pendiente para integración autorizada:

1. Conciliar los consumidores compartidos con ME-OPS2B y revisar ambos diffs; no sustituir su aceptación con este worktree.
2. Identificar conexión, esquema y versión efectiva; generar respaldo transaccional privado y verificar su restauración en aislamiento.
3. Aplicar exclusivamente 000014 con `php artisan migrate --database=<conexion_autorizada> --path=database/migrations/2026_11_28_000014_completar_graduandos_operativos.php --force`, solo después de recibir autorización específica para esa instancia.
4. Comprobar esquema, conteos y relaciones previas; activar `ME_GRADUANDOS_HABILITADOS=true` en la configuración efectiva únicamente con esquema compatible. En producción el módulo permanece denegado mientras esté deshabilitado o falte su esquema. No se agrega un error global 503.
5. Verificar registro, consulta, inscripción y ámbitos con sesiones sintéticas autorizadas, y disponibilidad de los módulos previos. El rollback ordinario del código desactiva la bandera; no ejecutar `down` sobre datos nuevos para revertir una publicación.

No se aplicaron migraciones a MySQL 3328. Frontend 5188 y salud de API 8008 respondieron 200 durante el trabajo. La identidad de Ernesto se protege por aislamiento: no se accedió a sus credenciales ni se escribió su base para esta fase.

## QA y puntos de control

Ejecutor: `node tests/qa-admin-core.mjs --graduandos --servir --automatizado --chrome`. Variante `--iterar` conserva solo el entorno temporal para diagnóstico y acepta `phpunit`, `chrome` o `cerrar`. MySQL 3338, API 8018 y frontend 5189, con perfil Chrome y caché Vite exclusivos. Las credenciales aleatorias viven en memoria y stdin; los datos de navegador son ficticios.

| Comprobación | Resultado |
| --- | --- |
| Aislamiento de ambas ramas y worktrees | PASS. Base f065883; ME-OPS2B permanece en su directorio con cambios locales. |
| Migración, respaldo y restauración sintéticos | PASS. Perfil previo conservado; volcado fuera de Git y clon separado. |
| PHPUnit MySQL focalizado | PASS. 23 pruebas y 550 aserciones. Incluye las regresiones de inscripciones y vinculación, perfiles, ámbitos, referencias y concurrencia en procesos reales. |
| Rutas y CORS | PASS. 6 pruebas, 47 aserciones. Se actualizó una lista heredada de rutas que no incluía endpoints ya aprobados de perfil, cuentas y Eventos, además de las nuevas rutas de esta fase. |
| Chrome | PASS. Administrador, Colaborador, Institución y Graduando; registro, edición, inscripción, vínculo, búsqueda, paginación, persistencia, permisos, recuperación y conectividad. Administrador, Colaborador, Institución y Graduando; dos contextos de sesión independientes. |
| Responsive y temas | PASS. 72 muestras, sin desbordamientos; contraste mínimo de texto 5,28:1. 320, 390, 425, 768, 1024 y 1440 px; Claro, Oscuro y Sistema con ambos esquemas del dispositivo. |
| Typecheck, build, ESLint, Pint, diff | PASS. Typecheck y ESLint sin errores; build con avisos heredados de configuración Base44 y antigüedad de datos de compatibilidad, sin instalar paquetes. |
| Aceptación persistente | PASS disponibilidad HTTP durante el trabajo; NOT TESTED esta implementación allí, por exclusión expresa. |
| Dispositivos físicos, evaluación integral WCAG, módulos excluidos | NOT TESTED. |

Los fallos de iteración quedan visibles: la automatización inicial esperó texto del menú cerrado, intentó operar durante carga/cierre de diálogos y seleccionó un enlace de navegación en lugar del botón homónimo. Se corrigieron los localizadores y las esperas. Se agregó devolución explícita del foco al activador al cerrar los nuevos diálogos, con retorno a la búsqueda si el registro dejó de estar visible. La revisión visual también detectó y corrigió caracteres mal codificados en textos nuevos. La medición del contenido de los diálogos detectó un desbordamiento de 21 px en detalle a 320 px; se corrigió el ajuste mínimo y la partición de texto dentro del portal. La repetición dejó cero desbordamientos. No se rebajaron umbrales para ocultar resultados.

### Backend y persistencia

**PASS.** 23 pruebas y 550 aserciones sobre MySQL temporal. Registro, lectura, edición, normalización, ceros iniciales, documentos repetidos, homónimos sin consolidación, filtros combinados, paginación, validaciones directas, scopes de cuenta/institución/sede, revocación, integridad, rollback y cancelación. Procesos PHP coordinados verifican alta repetida 201/201 con una fila, documentos concurrentes 201/409, edición 200/409 e inscripción concurrente 201/201 o 201/409 según UUID/actor. La consulta después de recargar se contrasta con respuestas API y las pruebas `assertDatabaseHas` de MySQL.

### Chrome y sesiones

Recorrido automatizado con credenciales aleatorias entregadas por stdin. Los contextos de navegador independientes verifican revalidación después de una escritura desde otra sesión. Se comprueba reconexión/foco, bloqueo de escrituras sin conexión y ausencia de Service Worker/Cache Storage. La confirmación de vinculación se espera hasta que el servidor la guarde antes de cerrar sesión. **PASS.** El recorrido completo confirmó las cuatro sesiones y los ámbitos permitidos. Evidencia externa a Git: `C:/Users/Mike/AppData/Local/Temp/me-ops2c-SXhbQC/chrome/resultado.json`, `resultado-responsive.json` y ocho capturas de formularios. Los fallos de iteraciones anteriores se conservan con sus marcas de tiempo; el JSON final tiene cero fallos. Navegador verificado: `Chrome/158.0.8127.88`.

### Responsive y accesibilidad

**PASS.** 72 combinaciones de listado, detalle y formulario: seis anchos y cuatro esquemas (Claro, Oscuro, Sistema/claro y Sistema/oscuro). Se miden tanto la página como el contenido del diálogo. Cero desbordamientos y cero fallos de contraste de texto; mínimo 5,28:1. Chrome emula toque a 390 px; prueba Tab al extremo del diálogo, Escape y devolución del foco. **NOT TESTED:** dispositivos físicos y evaluación integral de WCAG del producto.

### Calidad técnica

**PASS.** `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json`, `node node_modules/vite/bin/vite.js build --config apps/web/vite.config.js`, ESLint focalizado sobre los consumidores JS/TS y ejecutores modificados, Pint en archivos PHP modificados y fixture de Chrome, y `git diff --check`. La compilación conserva los avisos heredados de Base44 y datos Browserslist/baseline antiguos. No se actualizaron dependencias para silenciarlos.

## Archivos de la fase

- `apps/api/app/Actions/GuardarGraduandoOperativo.php`
- `apps/api/app/Actions/InscribirGraduando.php`
- `apps/api/app/Http/Controllers/GraduandosController.php`
- `apps/api/app/Http/Controllers/RegistrosController.php`
- `apps/api/app/Http/Controllers/VinculosGraduandosController.php`
- `apps/api/app/Http/Requests/GuardarGraduando.php`
- `apps/api/app/Http/Requests/ListarGraduandos.php`
- `apps/api/app/Http/Requests/ListarRegistros.php`
- `apps/api/app/Http/Requests/ListarVinculosGraduandos.php`
- `apps/api/app/Models/Graduando.php`
- `apps/api/app/Policies/GraduandoPolicy.php`
- `apps/api/app/Policies/RegistroPolicy.php`
- `apps/api/bootstrap/app.php`
- `apps/api/config/cors.php`
- `apps/api/config/graduandos.php`
- `apps/api/database/migrations/2026_11_28_000014_completar_graduandos_operativos.php`
- `apps/api/routes/api.php`
- `apps/api/tests/Feature/IdentidadSinExposicionTest.php`
- `apps/api/tests/MySql/GestionGraduandosConcurrenciaTest.php`
- `apps/api/tests/MySql/GestionGraduandosTest.php`
- `apps/api/tests/MySql/RegistrosTest.php`
- `apps/api/tests/MySql/VinculacionGraduandosTest.php`
- `apps/web/src/app/Layout.jsx`
- `apps/web/src/app/pages.config.ts`
- `apps/web/src/features/acceso/cliente-sesion.ts`
- `apps/web/src/features/acceso/portal-graduando.tsx`
- `apps/web/src/features/acceso/portal-institucion.jsx`
- `apps/web/src/features/graduandos/cliente-graduandos.ts`
- `apps/web/src/features/graduandos/gestion-graduandos.tsx`
- `apps/web/src/features/paneles/AdminDashboard.jsx`
- `apps/web/src/features/paneles/VinculacionGraduandos.jsx`
- `apps/web/vite.config.js`
- `docs/engineering/ME-OPS2C.md`
- `tests/graduandos-chrome.mjs`
- `tests/qa-admin-core.mjs`
- `tests/semilla-graduandos.php`

## Cierre

**PASS · Punto de control de operaciones.** Núcleo e interfaces funcionales y probados en aislamiento; 23 pruebas MySQL/550 aserciones, 6 de rutas/CORS/47 aserciones, Chrome completo, 72 muestras responsive y calidad técnica aprobados. Se corrigieron los defectos encontrados dentro del alcance. No quedan fallos críticos abiertos de esta fase.

**GO técnico para PR**, sujeto a la integración posterior y a su revisión; esta fase no crea el PR. Se autoriza exclusivamente staging explícito, commit convencional en español y push normal de `feat/gestion-graduandos`, con confirmación posterior de SHA local/remoto y worktree limpio. El resultado de esa verificación Git se informa en la entrega. ME-OPS2B conserva su rama, cambios locales y bloqueo propio de conciliación; la aceptación no recibe esta migración ni este frontend.

**NOT TESTED / pendiente:** dispositivos físicos, PWA persistente, conciliación de históricos/consumidores Base44 y activación en aceptación. No se inició otro módulo ni se ejecutaron PR, merge o deploy.
