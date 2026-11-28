# ME-ADMIN-CORE — Identidad, Mi perfil y personal

## Estado de entrega

Implementación local en `feat/admin-core-identidad`, basada en el squash `85f54ab` de la PR #24 sobre `develop`. Sin commit, staging, push, PR, merge ni deploy. Sin dependencias nuevas. Los cambios se limitan a identidad, perfil, cuentas internas, sus pruebas y este documento.

**GO técnico del ensayo sintético. NO-GO para cerrar la identidad real de Ernesto o publicar.** La conexión del QA anterior en MySQL 3327 no está disponible en la configuración local actual. No se cambiaron esa cuenta, su contraseña, sus relaciones ni los fixtures anteriores. El responsable indicó aplicar la mejor opción: se conservó el QA previo y se trabajó en una instancia nueva.

## Punto de control 1: preflight

- PASS: `AGENTS.md`, `STANDARDS.md`, `DESIGN.md`, `AUTENTICACION.md` y dominio consultados; implementación contrastada con código.
- PASS: Git inicialmente limpio; GitHub confirmó PR #24 fusionada mediante squash, `merge_commit_sha=85f54aba941325b42f462af8bb92859a4765e276`.
- PASS: `git fetch origin`, `git switch develop`, `git merge --ff-only origin/develop`, `git switch -c feat/admin-core-identidad`.
- Rutas de trabajo: identidad/configuración/rutas/pruebas en `apps/api`, perfil/personal/navegación en `apps/web/src`, dos ejecutores focalizados en `tests` y esta documentación. Ventas, pagos e inventario operativo permanecen fuera del cambio.
- Se identificaron los archivos de entorno y las exclusiones sin abrir sus valores. Laravel utiliza su configuración al ejecutar los procesos; no se imprimen credenciales.

## Tarea 1: identidad y Mi perfil

La autoridad continúa en `users`, `roles` y `rol_user`. La migración agrega `users.principal`, nullable y único: se usa `true` para una sola cuenta y `null` para las demás. No crea usuarios, no selecciona una identidad por correo y no altera contraseñas. La marca no es fillable y ningún contrato HTTP permite editarla.

`cuentas:principal-qa {id}` prepara una cuenta administrativa **existente**, con el ID confirmado por el responsable. Exige terminal interactiva, entorno `testing`, conexión `mysql_pruebas`, host de bucle local y base `masterexpress_control_test`. Comprueba que no exista otra cuenta principal ni otro propietario de `admin@masterexpress.app`. En una transacción conserva el ID, hash, roles, auditoría y relaciones; fija Ernesto y el correo objetivo, protege la cuenta, la reactiva, revoca sesiones y audita. Si cambia el correo, elimina el estado de verificación. No envía correo.

El modificador voluntario `--establecer-clave` utiliza dos entradas ocultas con fallback visible deshabilitado. No se ejecutó sobre la identidad anterior de Ernesto. Sin el modificador, el comando conserva el hash. No hay rotaciones periódicas.

`UserPolicy::operarCuenta` bloquea a otros administradores sobre la cuenta principal. Ni su titular puede suspenderla o cambiar su rol. La regla del último administrador activo sigue vigente. No se crea un rol superadmin. Los cambios se serializan mediante el bloqueo del rol Administrador y de las cuentas afectadas; se revalidan permisos y versión de sesión dentro de la transacción.

`/MiPerfil` es una página completa, abierta desde el menú de cuenta del Administrador. Permite consultar nombre, correo, estado de verificación, roles, estado de cuenta y protección. Solo el nombre es editable. El correo y los roles no tienen editor. El cambio voluntario de contraseña exige la clave actual, confirmación y los límites existentes de 12 caracteres y 72 bytes; revoca todas las sesiones y exige volver a ingresar. Reutiliza la recuperación autónoma existente.

El cambio de correo futuro requiere un contrato separado que verifique el nuevo buzón y gestione las sesiones; no está habilitado aquí.

### Recuperación legítima

El titular conserva `/recuperar-contrasena` y el broker de Laravel: token con hash, caducidad de 30 minutos, consumo único y revocación de sesiones. Las pruebas demuestran que recuperar la cuenta principal conserva su ID, marca y rol. Otro administrador no puede restablecerla, suspenderla, revocar sus sesiones ni reasignarla por este módulo.

Si en QA no hay acceso al buzón, el operador local autorizado puede usar el comando anterior sobre el mismo ID y la entrada oculta, tras confirmar la identidad del titular. Este mecanismo no está habilitado en producción. Una pérdida simultánea de acceso al buzón y al sistema productivo requiere un procedimiento de operación aprobado y comprobación de identidad fuera de la aplicación; no se añadió una puerta de acceso administrativa.

## Tarea 2: personal y roles (histórico del ensayo inicial)

Cuentas internas permite crear, listar y paginar cuentas; consultar sus roles/estado; cambiar a un rol aprobado; suspender, reactivar, revocar sesiones e iniciar recuperación. Los cambios de rol revocan sesiones. No se alteran cuentas de Graduandos o Instituciones ni identidades que tengan roles externos.

Catálogo interno: Administrador, Colaborador, Vendedor, Finanzas e Inventario. Los roles de acceso siguen siendo exclusivamente Administrador y Colaborador. Los otros tres pueden recibir su contraseña mediante recuperación, pero no pueden iniciar sesión ni acceder a un portal operativo. No se inventaron permisos comerciales. La UI informa esta limitación.

La creación recibe únicamente nombres, apellidos y un rol. Laravel genera el correo con transliteración a ASCII, minúsculas y puntos entre partes. Se preservan todos los componentes del nombre y apellido. Ejemplos sintéticos:

| Rol | Correo generado |
| --- | --- |
| Administrador | `maria.jose.admin@masterexpress.app` |
| Colaborador | `maria.jose.perez.gomez@masterexpress.app` |
| Vendedor | `maria.jose.vendedor@masterexpress.app` |
| Finanzas | `maria.jose.finanzas@masterexpress.app` |
| Inventario | `maria.jose.inventario@masterexpress.app` |

Se rechazan identificadores administrativos reservados, nombres sin letras, partes vacías y una parte local mayor de 64 caracteres. Los duplicados se rechazan con 422; no se sobrescriben ni se adjudican silenciosamente correos. La UI pide usar un segundo nombre o apellido. El índice único de `users.email` conserva la garantía bajo concurrencia. El correo nunca determina autorización.

Una cuenta nueva recibe únicamente el hash de una credencial aleatoria desconocida. El Administrador pulsa **Iniciar recuperación**; el titular utiliza el enlace y elige su contraseña. El sistema no devuelve la clave inicial ni permite consultar hashes o contraseñas de otras personas. La creación no finge verificación del buzón.

La recuperación administrativa reutiliza el trabajo cifrado existente y se encola después del commit. La respuesta significa solicitud recibida, no entrega confirmada. En QA, los destinatarios de demostración `@masterexpress.app` solo se admiten con `testing` y `mysql_pruebas`, usando transporte `array` o SMTP de bucle local. El ensayo utilizó `array`: no hubo correo externo.

Auditoría: `eventos_de_cuenta` conserva actor, cuenta, acción y fecha. Registra creación con rol, nuevo rol, perfil, cambio/restablecimiento de contraseña, preparación de principal, suspensión, reactivación, revocación e inicio de recuperación. La consulta es exclusiva de Administrador y paginada. No contiene claves, hashes, tokens ni cuerpos sensibles. Los fallos de los endpoints nuevos se registran con mensaje fijo y tipo de excepción.

## Contratos HTTP y autorización

Todos los contratos nuevos requieren sesión vigente. Las mutaciones usan CSRF, validación en Form Requests, respuestas `no-store` y límites de frecuencia.

| Método y ruta | Contrato | Autorización |
| --- | --- | --- |
| GET `/api/mi-perfil` | Información propia | `UserPolicy::editarPerfil` |
| POST `/api/mi-perfil` | `{nombre}` | `editarPerfil`; revalidación bajo bloqueo |
| POST `/api/mi-perfil/contrasena` | `{current_password,password,password_confirmation}` | `editarPerfil`; clave actual y versión de sesión |
| GET `/api/administracion/cuentas` | Cuenta, roles, estado, protección y paginación | `gestionarCuentas` |
| POST `/api/administracion/cuentas` | `{nombres,apellidos,rol}` | `gestionarCuentas`; rol en catálogo Laravel |
| POST `/api/administracion/cuentas/{id}` | `{accion}`; también `{rol}` para `cambiar-rol` | `gestionarCuentas` y `operarCuenta`; bloqueos y protección de principal |
| GET `/api/administracion/cuentas/auditoria` | Eventos paginados, referencias por ID | `gestionarCuentas` |

Acciones de cuenta: `suspender`, `reactivar`, `revocar-sesiones`, `recuperar`, `cambiar-rol`. El perfil rechaza correo, roles y otros campos extra. La creación rechaza contraseña, correo manual, marca principal y roles externos o inventados.

## Componentes reutilizados

`PanelOperativo`, navegación y menú de cuenta, `SelectorTema`, TanStack Query, cliente de sesión y CSRF, `Card`, `Button`/`buttonVariants`, `Input`, `Label`, `Dialog`, y el broker/trabajo de recuperación. Los componentes JSX se consumen con el patrón de contratos TypeScript acotados ya empleado por `DatosCuentaPortal`; no se crea otra biblioteca. `GestionColaboradores.jsx` se inspeccionó y conserva su aislamiento del flujo de identidad: no se reactivó su editor de credenciales.

## Punto de control 2: operaciones y QA

MySQL 9.1 nuevo en `127.0.0.1:3328`, `masterexpress_control_test`, usuario con permisos solo sobre ese esquema y credenciales aleatorias en memoria. Migraciones ejecutadas únicamente allí. Laravel en 8008 y Vite en 5188; se preservaron los servicios previos 8000/5173. La cuenta principal del ensayo es sintética y no representa una copia ni un reemplazo de la identidad previa de Ernesto.

Ejecución reproducible desde la raíz, sin instalar paquetes:

```powershell
$env:ME_QA_TEMP_DIR = 'E:\CodexQA'
node tests/qa-admin-core.mjs --servir --iterar
```

El proceso acepta `phpunit` o `chrome` en su propia consola. Comparte sus credenciales efímeras únicamente con los procesos hijos. La automatización Chrome recibe su clave sintética por stdin y el soporte PHP devuelve los enlaces de recuperación solo al proceso de prueba, sin imprimirlos en el informe ni guardarlos en archivos.

| Comprobación | Resultado |
| --- | --- |
| `php vendor/phpunit/phpunit/phpunit tests/MySql/AdminCoreTest.php` | PASS: 17 pruebas, 235 aserciones |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS; conserva avisos de configuración Base44 y datos de navegadores antiguos |
| ESLint de los archivos frontend y ejecutores afectados, `--quiet` | PASS |
| `php vendor/bin/pint --test --dirty` | PASS |
| `php -l` en los 20 archivos PHP afectados y `git diff --check` | PASS |
| Chrome 158.0.8127.88, flujos nuevos | PASS |
| Identidad previa de Ernesto y contraseña elegida por el propietario | BLOCKED por falta de conexión al QA anterior; no se rotó la clave |
| Correo externo, aprovisionamiento y publicación productivos | NOT TESTED; fuera del ensayo |

PHPUnit cubre persistencia de perfil sin cambiar ID/hash/roles/correo, rechazo de escalamiento, protección con segundo administrador y correo distinto, último administrador, alta de los cinco roles, duplicados y reservados, rechazo de roles externos/superadmin y campos extra, sesiones, recuperación principal con token consumido, cambio voluntario con clave actual, autorización y anonimato, auditoría y comando QA con preservación de relaciones y colisión de correo.

Chrome comprobó ingreso sintético, navegación desde el menú a `/MiPerfil`, edición del nombre y recarga, ausencia de editor de roles, altas de Colaborador y segundo Administrador, normalización y duplicado con error asociado al campo, recuperación administrativa con trabajador y correo `array`, establecimiento de contraseña del titular, acceso del segundo Administrador y rechazo de operaciones sobre principal, rechazo de rol inventado y de administración por Colaborador, suspensión/reactivación y sesiones reales con 401 después de suspensión y revocación. No se repitieron OTP ni ME-OPS1A.

UI comprobada a 390 y 1440 px, claro y oscuro, sin desbordamiento horizontal; Escape y retorno de foco en el diálogo; teclado y foco; reflow a 720 px como equivalente al 200 %. Se observó también el indicador nativo Chrome al 200 % en ambas vistas. La captura instrumentada de Mi perfil registra 712 px CSS, DPR 2 y desbordamiento falso. La captura instrumentada de personal se tomó al 100 % tras interacción local; no se presenta como evidencia instrumentada del 200 %.

Evidencia externa a Git: `E:\CodexQA\me-admin-core-hhEAEd\chrome`. Incluye las ocho vistas de perfil/personal por ancho y tema, duplicado, auditoría, reflow y capturas de revisión nativa. `resultado.json` corresponde a la corrida automática de flujos; las mediciones nativas se guardan por separado.

### Fallos encontrados y tratamiento

- FAIL inicial de PHPUnit: montaje de usuarios sin refrescar valores por defecto, sesión del actor anterior retenida y fixture sintético que impedía simular último administrador/duplicado. Se corrigió el montaje de la suite y se conservaron los casos negativos. La corrida final indicada pasó.
- FAIL de Chrome: el diálogo nuevo no tenía `DialogTrigger`, por lo que Escape devolvía foco al body. Se agregó referencia explícita al botón y `onCloseAutoFocus`. La repetición pasó.
- FAIL del ejecutor de revisión: búsqueda de ventana CDP sin target y sondeo del body durante navegación. Se corrigieron en el ejecutor. No fueron fallos de los flujos Laravel.
- BLOCKED temporal de infraestructura: C: sin espacio. Se trasladaron únicamente los temporales generados por esta tarea a E:, conservando los datos. No se borraron ni movieron los fixtures previos.

## Archivos de la entrega

Backend: `User.php`, `UserPolicy.php`, `CuentasInternasController.php`, `MiPerfilController.php`, `RecuperacionController.php`, `OperacionDeCuenta.php`, `CrearCuentaInterna.php`, `GuardarPerfil.php`, `CambiarContrasenaPropia.php`, `CorreoInterno.php`, `PrepararAdministradorPrincipal.php`, `OrigenPublico.php`, `TransporteDeCorreoSeguro.php`, `bootstrap/app.php`, `config/auth.php`, `config/cors.php`, `routes/api.php` y migración `2026_11_28_000010_proteger_cuenta_principal.php`.

Frontend: `pages.config.ts`, `cliente-sesion.ts`, `AdminDashboard.jsx`, `GestionCuentasInternas.tsx`, `cliente-personal.ts`, `mi-perfil.tsx` y `PanelOperativo.jsx`.

QA: `AdminCoreTest.php`, `tests/soporte-admin-core.php`, `tests/qa-admin-core.mjs` y `tests/admin-core-chrome.mjs`. No se cambiaron manifiestos ni lockfiles.

## Punto de control 3: entrega y siguiente fase

PASS: control final de alcance, UTF-8/LF, sintaxis PHP, typecheck, build, lint afectado, formato y diff. Git conserva 30 archivos de entrega (16 modificados y 14 nuevos), sin staging. Manifiestos y lockfile sin cambios. Entornos, dependencias y compilación siguen excluidos; la evidencia de navegador permanece fuera del repositorio.

La revisión sintética está disponible en `http://127.0.0.1:5188/` mientras continúe el proceso QA; la sesión visible se preparó con la identidad sintética. Esta URL no certifica el ingreso con la contraseña anterior del propietario.

Paso pendiente concreto: recuperar la conexión autorizada de QA anterior, obtener una copia aislada conservando IDs/historial y ejecutar `cuentas:principal-qa ID_EXISTENTE` sobre esa copia, sin `--establecer-clave` si la contraseña ya está elegida. Después el titular debe ingresar su clave localmente y validar el login. No se debe usar el comando para crear otra cuenta ni suponer que el correo QA aprovisiona un buzón productivo.

ME-OPS-CORE queda para una fase posterior: acordar permisos y portales de roles sin acceso, vínculos operativos y corte de consumidores heredados. No se inició esa fase ni módulos comerciales.


## Cierre funcional de cuentas internas y cierre de sesión

El propietario confirmó el ingreso como Ernesto. La cuenta 27 conserva su correo, acceso y protección. La causa del aviso persistente era que el sistema compartido enviaba las propiedades de Radix a elementos HTML que no ejecutaban el temporizador ni cerraban el aviso. Se restauraron los componentes de Radix. Solo el aviso de salida recibe 4000 ms. El sistema retira avisos cerrados y descarta el aviso de salida al volver a iniciar sesión.

- El alta directa recibe nombre completo, correo electrónico, un rol autorizado y, si aplica, una contraseña temporal manual. La generación automática y el restablecimiento administrativo devuelven la temporal una vez. La lista y la auditoría excluyen la clave. La marca de cambio inicial bloquea operaciones protegidas hasta elegir otra contraseña y volver a ingresar.
- El listado busca nombre o correo con 300 ms de espera. Laravel aplica filtros de rol, estado, disponibilidad para ingresar y fecha de alta, con 25 cuentas por página. El listado distingue acceso disponible y cambio inicial pendiente. Las acciones usan un menú con etiquetas, iconos y áreas táctiles de 44 px. Las operaciones sensibles requieren confirmación.
- La cuenta principal conserva las protecciones de servidor. El nombre de las demás cuentas puede editarse. El restablecimiento temporal de otra cuenta revoca sesiones y enlaces anteriores. La recuperación por correo sigue como alternativa.
- Aceptación usa el almacenamiento persistente en MySQL 3328 mediante el arranque de 5188 y API 8008. PHPUnit y Chrome automatizado usan otra instancia en 3338.


### Evidencia del cierre

| Comprobación | Resultado |
| --- | --- |
| PHPUnit focalizado en MySQL 3338 | PASS · 19 pruebas, 318 aserciones. Validación del correo personal, duplicados, roles, cuenta principal, administración, cambio inicial y paginación 25 + 1 con rango de fecha. |
| Chrome 158, web 5189 y API 8018 | PASS · Alta con correo personal, entrega única, 422 ante duplicado, 403 durante cambio inicial, ingreso con contraseña definitiva, búsqueda y protección de cuenta principal. |
| Aviso en Chrome | PASS · Desaparece automáticamente, se cierra con teclado o toque y no reaparece en el siguiente ingreso. La primera corrida falló durante la transición de foco. La repetición esperó al formulario de ingreso y verificó el foco antes de presionar Espacio. |
| Listado afectado | PASS · 390, 425 y 1440 px, claro y oscuro, sin desbordamiento. Acciones de 44 px. Contraste mínimo medido de 15,9:1 en el botón de acciones. |
| Controles estáticos | PASS · Typecheck, build, ESLint de archivos afectados, Pint y git diff --check. El build conserva los avisos de configuración Base44 y antigüedad de datos de navegadores. |
| Arranque persistente | PASS · npm.cmd run dev:local -- --aceptacion --reiniciar reinició Vite y Laravel. MySQL 3328 mantuvo su proceso y la identidad principal 27. La URL respondió 200. |
| Activación del alta directa en 5188 | BLOCKED al cierre funcional anterior. Resuelto en la aceptación técnica final. |
| Login personal después del reinicio y selector Sistema | El propietario confirmó el ingreso previo. La aceptación técnica final cubrió Sistema y conservó la cuenta principal. |

Los resultados y las seis capturas de ese ensayo están en E:/CodexQA/me-admin-core-RbxMxP/chrome. Las capturas se tomaron fuera de la entrega de contraseña.

## Aceptación técnica final · 28 de noviembre de 2026

| Comprobación | Resultado |
| --- | --- |
| Respaldo previo | PASS · Volcado consistente de la base persistente, comprobado en memoria y cifrado con DPAPI para el usuario local. El descifrado reprodujo los bytes originales. El archivo quedó fuera de Git, en E:/CodexQA/aceptacion-cierre-admin. NOT TESTED · Restauración en una instancia aparte. |
| Migración autorizada | PASS · Se aplicó únicamente `php artisan migrate --database=mysql_pruebas --path=database/migrations/2026_11_28_000011_agregar_cambio_inicial_de_contrasena.php --force` a MySQL 3328, esquema `masterexpress_control_test`, entorno `testing`. El paso de aplicación añade una columna booleana con valor inicial `false`. Se conservaron los 10 registros previos. |
| Identidad principal | PASS · La comparación antes y después conservó íntegros el registro 27, sus credenciales, las asociaciones de rol y su auditoría. Ernesto sigue activo, con rol Administrador, marca principal y cambio inicial desactivado. Chrome mostró la sesión existente del titular. Después del reinicio, otra administradora sintética comprobó los campos de la cuenta por HTTP. |
| Alta y cambio inicial | PASS · Chrome 158 en 5188 creó una cuenta sintética, comprobó la entrega única, el rechazo del duplicado (422), el bloqueo de la cuenta mientras tenía cambio inicial (403), el cambio y el ingreso con la clave definitiva. La cuenta 160 se reutilizó en la repetición y quedó suspendida y auditada. |
| Listado y protección | PASS · Chrome y HTTP verificaron búsqueda por correo, filtros combinados de rol, estado y acceso, consulta de la segunda página vacía y rechazo (403) al intentar restablecer la cuenta principal desde otra administración. El rango de alta y la paginación con 26 registros quedaron cubiertos en PHPUnit aislado. |
| Aviso de salida | PASS · Cierre por teclado, toque emulado, desaparición automática y ausencia al volver a iniciar sesión. En el primer ensayo, la pulsación del ejecutor falló durante la transición. La repetición habilitó emulación táctil y comprobó que el punto de toque alcanzaba el botón. |
| Vistas y tema | PASS · 390, 768 y 1440 px sin desbordamiento en Claro y Oscuro. El control de acciones midió 44 px y un contraste mínimo de 16,26:1. En Sistema, Chrome cambió la preferencia emulada de oscuro a claro y a oscuro, y la interfaz siguió los tres cambios. |
| Reinicio local | PASS · `npm.cmd run dev:local -- --aceptacion --reiniciar` reinició Vite 5188 y API 8008. La web respondió 200, `GET /api/mi-sesion` respondió 401 sin sesión y 200 con sesión sintética. El almacenamiento MySQL 3328 y el registro 27 permanecieron disponibles. NOT TESTED · Nuevo ingreso con la contraseña privada del titular después de ese reinicio. |
| Verificaciones anteriores | PASS · Se conservó la evidencia de 19 pruebas y 318 aserciones en MySQL aislado 3338, typecheck, build, lint afectado y Pint. La fase final cambió documentación y aplicó la migración ya ensayada. |

La evidencia de pantalla y del navegador permanece en E:/CodexQA/aceptacion-cierre-admin. El arranque de aceptación reutiliza su perfil local cifrado. Las pruebas automatizadas conservan su almacenamiento aparte. El cierre cubre ME-ADMIN-CORE y queda listo para revisión mediante PR.
