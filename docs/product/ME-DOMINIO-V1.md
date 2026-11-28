# ME-E0 — Contrato del núcleo empresarial V1

Base revisada: `13f3dcba56129303c08ee4d013d070d4dc292d74` de `develop`, que integra ME-SEC1A mediante la [PR #14](https://github.com/MaickR/master-express-app/pull/14).

**Estado.** Contrato para revisión. **Verificado** describe el código o los esquemas versionados en esa base. **Confirmado** identifica decisiones del alcance V1 o restricciones de ME-E0. **Propuesto** describe el destino Laravel/MySQL. Las decisiones abiertas de la sección 13 requieren validación con Ernesto antes de implementar la parte afectada. La revisión del legado abarca el cliente React/JSX y sus integraciones. Los permisos efectivos y los datos remotos de Base44 requieren verificación independiente.

## 1. Entidades y responsabilidades

| Entidad | Responsabilidad propuesta | Evidencia vigente |
| --- | --- | --- |
| Institución | Identidad estable de la organización educativa. El nombre y el tipo son atributos descriptivos. | El evento guarda `nombre_institucion` y `tipo_institucion` sin referencia a un catálogo. [Evento](../../base44/entities/Evento.jsonc#L5-L16) |
| Sede | Unidad de una institución que ubica y delimita su operación. | El lugar del evento es texto libre y la interfaz lo presenta como auditorio o lugar físico. [Evento](../../base44/entities/Evento.jsonc#L17-L35), [gestión de eventos](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L178-L200) |
| Evento | Agrupa la programación de grado de una institución, fecha y lugar. | El alta crea una fila de evento y luego sus ceremonias. [Gestión de eventos](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L35-L77) |
| Ceremonia | Sesión identificable del evento, con nombre, orden y hora cuando se conozca. Es el destino de la participación. | El esquema exige `evento_id` y nombre. Admite hora y orden. [Ceremonia](../../base44/entities/Ceremonia.jsonc) |
| Graduando | Persona que participa. Su identidad operativa se reutiliza en sus registros. | La fila heredada reúne datos personales, programa, referencias, pago, colaborador y papelera. [Graduando](../../base44/entities/Graduando.jsonc) |
| Registro | Inscripción de un graduando en una ceremonia. Conserva fecha, procedencia y trazabilidad del actor. | Cada envío crea una fila `Graduando` con ambos IDs. [Formulario](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L182-L244) |
| Comprador | Parte comercial que adquiere productos o servicios para un beneficiario. | El legado captura datos del graduando y del pago en la misma fila, sin identificador de comprador. [Formulario](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L52-L67), [esquema](../../base44/entities/Graduando.jsonc#L46-L97) |
| Usuario | Cuenta autenticable de Laravel y sujeto de autorización. Puede tener roles y vínculos operativos verificados. | Laravel conserva identidad y roles. El registro legado se atribuye a un ID de Colaborador de Base44. [Identidad](../engineering/IDENTIDAD.md), [formulario](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L212-L220) |

## 2. Relaciones y cardinalidades propuestas

| Relación | Cardinalidad y regla |
| --- | --- |
| Institución → Sede | Una institución tiene 0..N sedes. Cada sede pertenece a exactamente una institución. |
| Institución → Evento | Una institución tiene 0..N eventos. Cada evento operativo pertenece a exactamente una institución identificada. |
| Sede → Evento | Una sede tiene 0..N eventos. Se propone 0..1 sede por evento, de la misma institución. Si se exige sede para operar, los casos sin resolver quedan en revisión. |
| Evento → Ceremonia | Un evento programado tiene 1..N ceremonias. Cada ceremonia pertenece a exactamente un evento. Las estructuras importadas incompletas quedan fuera del conjunto operativo mientras se concilian. |
| Graduando ↔ Ceremonia | N:M mediante Registro. Cada registro válido referencia exactamente un graduando y una ceremonia. Se propone un registro canónico por par, con historial auditable. Falta decidir si se admiten varias ceremonias válidas en el mismo evento. |
| Usuario ↔ Institución | N:M mediante asignaciones verificadas y revocables con ámbito explícito. La asignación y el rol se comprueban juntos. |
| Usuario → Registro | Un usuario puede originar 0..N registros. El alta en línea tiene exactamente un actor autenticado. Un histórico puede carecer de actor Laravel verificado y conserva su procedencia. El actor de captura y el ámbito vigente se comprueban por separado. |
| Graduando o Comprador → Usuario | Ambos perfiles pueden existir sin cuenta. Si hay vínculo de acceso, debe verificarse. Quedan abiertas la cardinalidad de cuentas por perfil y la representación por terceros. |
| Comprador → Venta futura | Un comprador puede originar 0..N ventas. Se propone un comprador responsable por venta cuando el flujo aprobado lo identifique. Los beneficiarios se vincularán con las reglas comerciales aprobadas. Una inscripción puede existir sin venta. |

## 3. Diferencia entre evento y ceremonia

El evento reúne la programación que hoy se registra con nombre y tipo de institución, fecha, lugar y número de ceremonias. La ceremonia identifica una sesión del evento y admite hora opcional. El alta genera nombres y órdenes consecutivos. La pantalla ofrece entre una y seis ceremonias. El límite de negocio y la programación de varios días quedan abiertos. [Evento](../../base44/entities/Evento.jsonc), [Ceremonia](../../base44/entities/Ceremonia.jsonc), [alta](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L53-L71), [selector](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L184-L200)

En Laravel se propone derivar el evento de la ceremonia y el número real de ceremonias de la relación. El conteo legado se conserva para conciliación. La cantidad solicitada al alta sirve para crear las sesiones iniciales.

## 4. Institución y sede

- **Verificado.** `tipo_institucion` admite `universidad` o `colegio`. El nombre y el lugar se capturan en campos independientes del evento. [Esquema](../../base44/entities/Evento.jsonc#L5-L25), [formulario](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L161-L188)
- **Confirmado.** Nombre, alias, dominio de correo y coincidencias de texto carecen de efectos sobre el acceso. El rol Institución por sí solo carece de alcance. [Identidad](../engineering/IDENTIDAD.md)
- **Propuesto.** Conciliar los nombres de origen con una identidad institucional validada y conservar la correspondencia. `lugar` sigue siendo descriptivo. La sede pertenece por ID a la institución y puede coincidir con el lugar físico o ser una unidad distinta.

## 5. Graduando, comprador y usuario

El graduando participa. El comprador adquiere y puede ser el propio graduando o un tercero. El usuario actúa mediante una cuenta. Coincidencias de correo, teléfono y nombre sirven para revisión. Carecen de efectos automáticos sobre titularidad, acceso y consolidación.

**Verificado.** El formulario exige nombre, paquete y medio de pago. El esquema declara obligatorios nombre y paquete. El alta carece de un identificador verificado de persona y una referencia separada a comprador. Si hay correo de graduando, el cliente intenta enviar la confirmación después de guardar. Un fallo de correo conserva el registro guardado. [Formulario](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L182-L244), [esquema](../../base44/entities/Graduando.jsonc#L109-L112), [correo](../../apps/web/src/integrations/emailjs/emailService.js#L356-L358)

**Propuesto.** Resolver la identidad por un identificador estable aprobado y aplicar unicidad en su ámbito. Mantener identidades ambiguas pendientes de revisión, sin otorgar acceso ni crear perfiles operativos duplicados. El programa académico puede variar por inscripción y se propone conservarlo en ese contexto. El servidor deriva el actor de la sesión y su vínculo operativo verificado. Un histórico sin correspondencia conserva el ID legado y queda con atribución pendiente. [Identidad](../engineering/IDENTIDAD.md)

## 6. Participación del graduando

**Verificado.** El formulario consulta eventos activos. Cambiar de evento limpia la ceremonia, descarta respuestas previas y filtra por pertenencia. Antes de subir comprobantes o guardar, relee ambos IDs, verifica que el evento siga activo y que la ceremonia le pertenezca. La consulta de registros permite ver históricos sin ceremonia por evento, y aplicar el filtro de ceremonia sin modificar el histórico. [Selección](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L85-L131), [envío](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L182-L220), [consulta](../../apps/web/src/features/graduandos/TodosRegistros.jsx#L185-L233), [caso histórico](../../tests/vinculo-ceremonias.mjs#L168-L182)

**Propuesto.** Laravel resuelve y autoriza ceremonia y evento en la operación de alta. Las participaciones de un evento se consultan a través de sus ceremonias. Históricos sin ceremonia, huérfanos o cruzados se conservan para conciliación y quedan fuera de participación confirmada y demanda. Si se admite un traslado, debe validar destino y alcance, impedir un vínculo activo equivalente y auditar el motivo.

## 7. Invariantes de integridad propuestas

| ID | Regla verificable |
| --- | --- |
| I1 | Una ceremonia operativa referencia un evento existente. Cada alta referencia un graduando y una ceremonia disponibles de un evento elegible. El evento se deriva de la ceremonia. Si la ruta incluye ambos IDs, se valida el parentesco. |
| I2 | La sede pertenece a la institución del evento. Asignaciones explícitas vigentes resuelven el alcance por ID. Consultas, conteos y mutaciones aplican el mismo ámbito. |
| I3 | Laravel determina el actor. Campos enviados por el cliente para atribuir actor, rol o titularidad se rechazan. Un histórico sin actor verificado conserva su procedencia y requiere una correspondencia aprobada antes de atribuirse. |
| I4 | La identidad canónica se resuelve antes de activar el registro. La unicidad transaccional por graduando y ceremonia conserva un solo registro, incluso con altas concurrentes y claves de operación diferentes. Un segundo envío con diferencias sustantivas requiere conciliación. Las filas históricas consolidadas conservan sus referencias de origen. |
| I5 | Cada registro canónico vigente cuenta una vez como participación. La demanda productiva se cuenta por unidad o agrupación comercial aprobada con una clave única de origen. Reintentos, importaciones repetidas y filas legadas equivalentes carecen de efectos adicionales. El alta de inscripción jamás activa demanda. Ernesto debe validar el origen y la condición que activan o revierten la demanda. |
| I6 | Inscribir jamás confirma venta o pago. Paquete, abono, saldo, comprobante y `estado_pago` legados son evidencia por conciliar. Estos campos quedan fuera de la escritura de registro. El contrato comercial determinará la verificación en servidor de importe, moneda, medio, estado y responsable. |
| I7 | Crear un evento y sus ceremonias iniciales es atómico. El alta de registro valida la disponibilidad en una transacción protegida frente a cambios concurrentes. Las referencias históricas impiden una eliminación física que deje huérfanos. Los cambios de disponibilidad y las restauraciones revalidan vínculos y se auditan. |
| I8 | Cada mutación reintentable usa un `operation_id` UUID estable. Tras autenticar y autorizar de nuevo, el servidor verifica unicidad por actor, tipo de operación e ID, compara objetivo y contenido normalizado, y guarda el resultado junto con el cambio. La repetición idéntica recupera el resultado autorizado. Reusar la clave con otro objetivo o contenido devuelve `409`. Una sesión vencida o autorización revocada impide el envío y la consulta del resultado protegido. |
| I9 | Efectos posteriores, como el correo, se identifican por registro y tipo de efecto. La intención de envío se registra junto con el alta. Se despacha después de confirmar la transacción y se reintenta sin crear otro registro. Si el proveedor pudo aceptar un envío sin confirmarlo, se verifica antes de repetirlo. El contrato comercial debe resolver el acceso a los adjuntos y las cargas parciales. |

La idempotencia adopta el principio del [contrato PWA](ME-PWA.md#borradores-cola-y-sincronización). El trabajo desconectado de Vendedor y el pago provisional pertenecen a una fase posterior.

## 8. Estados y transiciones existentes

| Recurso | Estado o transición verificada | Tratamiento propuesto |
| --- | --- | --- |
| Evento | `activo` booleano con valor inicial `true`. El alta lo establece en verdadero. El selector de registro filtra activos. La gestión lista eventos y solicita el borrado de las ceremonias cargadas antes de borrar el evento en otra llamada. El componente carece de flujo de desactivación o reactivación. | Acordar el ciclo, responsables y efecto sobre inscripciones previas. Preservar referencias. [Esquema](../../base44/entities/Evento.jsonc#L26-L41), [gestión](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L35-L93), [selector](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L85-L95) |
| Ceremonia | El esquema carece de estado. Se observa creación inicial y borrado desde el evento. | Validar si necesita disponibilidad independiente y en qué condiciones se retira de la operación. [Esquema](../../base44/entities/Ceremonia.jsonc), [gestión](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L53-L93) |
| Fila de Graduando | Nace con `eliminado: false`. Registros excluye los marcados. Papelera consulta `eliminado: true` y restaura a falso limpiando `fecha_eliminacion`. La interfaz vigente carece de acción de envío a papelera en Registros y de borrado definitivo en Papelera. | Migrar el marcador histórico. Acordar baja lógica, elegibilidad para restaurar y retención. Restaurar jamás confirma pagos. [Alta](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L212-L220), [registros](../../apps/web/src/features/graduandos/TodosRegistros.jsx), [papelera](../../apps/web/src/features/graduandos/PapeleraGraduandos.jsx#L33-L65), [sesión](../engineering/AUTENTICACION.md#datos-locales-y-servicios-pendientes) |
| Pago legado | En el alta se asigna `completo` si `valor_total - abono <= 0` y `pendiente` en los demás casos. Guarda el saldo con mínimo cero. El flujo inspeccionado asigna el valor al crear. | Conciliar ambos atributos como evidencia. Precio cero o sobreabono pueden derivar en `completo` por aritmética. La etiqueta carece de valor como confirmación contable. [Cálculo](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L208-L220), [esquema](../../base44/entities/Graduando.jsonc#L67-L93) |
| Consulta de ceremonias | `inicial`, `cargando`, `listo` y `error` pertenecen al formulario. | Mantener esos estados en la interfaz. [Formulario](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L102-L129) |

## 9. Matriz de permisos por rol y recurso

**Verificado.** Laravel habilita rutas de panel para Administrador y Colaborador. `/RegistroGraduando` se reserva a Colaborador y exige un perfil operativo. El vínculo por correo se resuelve exclusivamente en la demostración local cuando hay un solo perfil coincidente y este no está marcado como inactivo. Administración abre eventos, registros, exportación y papelera sobre Base44. Colaborador consulta por `colaborador_id` y descarta filas en papelera. Son comportamientos de navegación y consulta. La autorización efectiva de estos recursos requiere verificación en servidor. [Rutas](../../apps/web/src/app/pages.config.ts#L9-L20), [perfil local](../../apps/web/src/app/Layout.jsx#L18-L52), [panel administrativo](../../apps/web/src/features/paneles/AdminDashboard.jsx#L99-L113), [panel de Colaborador](../../apps/web/src/features/paneles/ColaboradorDashboard.jsx#L19-L53), [cliente Base44](../../apps/web/src/integrations/base44/base44Client.js#L9-L21)

**Propuesta para validar.** Toda concesión exige una Policy de servidor para la acción y el recurso. «Futuro» significa denegado por defecto hasta aprobar la regla y habilitar el flujo.

| Rol | Instituciones y sedes | Eventos y ceremonias | Graduandos y registros | Compradores |
| --- | --- | --- | --- | --- |
| Administrador | Consultar y gestionar en ámbito administrativo aprobado. | Consultar, programar y rectificar en ese ámbito. Retiro sujeto a ciclo aprobado. | Consultar y rectificar según ámbito. Exportación y restauración con permisos propios. Alta denegada hasta validar el caso. | Denegado. Futuro acceso comercial explícito. |
| Colaborador | Consultar referencias mínimas requeridas por su asignación. | Consultar programación disponible en su asignación. | Crear y consultar registros capturados por su vínculo operativo, dentro del ámbito vigente. Edición, traslado, restauración y exportación general denegados. | Denegado. |
| Vendedor | Futuras referencias mínimas asignadas. | Futura consulta comercial asignada. | Futuros datos mínimos de beneficiarios de ventas asignadas. | Futuro acceso ligado a ventas autorizadas. |
| Finanzas | Denegado. | Denegado. | Futuras referencias mínimas para conciliación. | Futuros datos mínimos de facturación o conciliación. |
| Inventario | Denegado. | Futuras referencias de programación de producción asignada. | Futura demanda agregada o datos imprescindibles de trabajo asignado. | Denegado. |
| Graduando | Denegado. | Futura consulta de programación propia verificada. | Futuro acceso a sus registros con vínculo verificado. | Denegado. Cualquier acceso comercial requiere un vínculo específico. |
| Institución | Futura consulta de institución y sedes asignadas expresamente. | Futura consulta de programación del ámbito verificado. | Futura consulta mínima o agregada, según finalidad y autorización. | Denegado. |

Una cuenta con varios roles debe satisfacer completamente una concesión aplicable, incluido su ámbito, para cada acción. Los filtros del cliente y los IDs directos no amplían el alcance. Aplicar las mismas restricciones a listados, detalles y conteos, con permisos separados para exportaciones y adjuntos. Los cambios de rol, ámbito o vigencia se aplican al operar y al reintentar.

## 10. Endpoints Laravel propuestos

Prefijo `/api`. Las operaciones son candidatas y dependen de la matriz y las decisiones de Ernesto.

| Método y ruta | Contrato |
| --- | --- |
| `GET /instituciones`, `GET /instituciones/{institucion}/sedes` | Listados paginados, limitados por asignación. |
| `POST /instituciones`, `PATCH /instituciones/{institucion}` | Alta y actualización administrativa por ID. |
| `POST /instituciones/{institucion}/sedes`, `PATCH /instituciones/{institucion}/sedes/{sede}` | Gestionar sede. Valida pertenencia a la institución y alcance. |
| `GET /eventos`, `GET /eventos/{evento}`, `GET /eventos/{evento}/ceremonias` | Consultar programación. Filtrar eventos por institución, sede y disponibilidad dentro del ámbito. |
| `POST /eventos` | Alta idempotente de evento con institución, sede cuando corresponda y ceremonias iniciales en una transacción. |
| `PATCH /eventos/{evento}`, `PATCH /eventos/{evento}/ceremonias/{ceremonia}` | Rectificar programación con control de versión y parentesco. Los cambios de disponibilidad requieren reglas aprobadas. |
| `GET /graduandos/{graduando}` | Perfil mínimo con acceso derivado de registros autorizados o de un vínculo propio verificado cuando se habilite el portal. |
| `GET /registros`, `GET /registros/{registro}` | Consulta paginada y detalle. Filtros por evento y ceremonia, con alcance y campos definidos por servidor. |
| `POST /ceremonias/{ceremonia}/registros` | Recibe `operation_id`, referencia autorizada a un graduando o datos mínimos para resolver su identidad según la regla aprobada, y datos de inscripción. Resuelve persona y registro en la misma transacción si corresponde y devuelve el ID canónico. |
| `POST /registros/{registro}/restauracion` | Sujeto a aprobación de papelera. Revalida disponibilidad, unicidad y alcance antes de restaurar. |

Propuesta HTTP. `201` para altas, `200` para consultas y actualizaciones que devuelven un recurso, y respuesta original al reintentar con autorización. `401` sin sesión, `403` para una acción denegada al rol, `404` para recursos inexistentes o fuera de ámbito, `409` para conflictos de estado, versión, duplicado incompatible o idempotencia, y `422` para entradas inválidas. Aplicar CSRF a mutaciones de la SPA y límites acordes a la operación. Las operaciones de compradores, ventas, pagos, exportación, traslado y retiro quedan abiertas. [Contrato HTTP de sesión](../engineering/AUTENTICACION.md#contrato-http)

## 11. Estrategia incremental desde Base44

| Paso | Autoridad y criterio para avanzar |
| --- | --- |
| 1. Inventario y ensayo | Base44 sigue registrando la operación heredada. Inventariar entidades y consumidores, ensayar con datos ficticios y definir un canal de extracción autorizado. Detectar diferencias de conteos, homónimos, referencias huérfanas, filas sin ceremonia, duplicados e inconsistencias de pago. |
| 2. Correspondencias y carga repetible | Versionar un mapeo único por origen, entidad e ID legado y conservar el rastro de consolidaciones. Cargar instituciones y sedes validadas, eventos y ceremonias, luego graduandos y registros. Conciliar conteos de filas leídas, aceptadas, consolidadas, en papelera y en revisión. Mantener históricos ambiguos pendientes, sin habilitar acceso ni promover pagos. |
| 3. Lectura de contraste | Laravel lee la copia para comparar conteos y vínculos mientras las escrituras siguen en Base44. Conciliar por evento, ceremonia, vigencia, atribución y duplicados. Identificar consumidores como listados, exportaciones, reportes y correo. Aislar la lectura comercial heredada durante su propia fase. |
| 4. Corte por capacidad | Cortar programación y después registros si los consumidores admiten la transición, o realizar un corte coordinado. Pausar los escritores legados afectados, aplicar el último delta y comprobar integridad. Laravel pasa a ser el único escritor de la capacidad activada. Alimentar lectores legados con una proyección de lectura acotada si hace falta. Separar el flujo comercial heredado o posponer el corte de registro mientras ambos flujos sean indivisibles. |
| 5. Verificación y reversión | Validar permisos, conciliación y efectos secundarios antes de abrir cada capacidad. Para revertir, pausar escrituras, capturar y conciliar el delta de Laravel con el destino aprobado, verificar IDs y conteos, y reactivar un único escritor. Mantener solo lectura si la conciliación sigue pendiente. Importar o revertir jamás confirma pagos, genera demanda ni reenvía notificaciones. |

Las llamadas separadas de alta o borrado en gestión y de carga de comprobantes y alta en registro permiten resultados parciales. Eventos con menos ceremonias, huérfanos y adjuntos sin registro son escenarios por conciliar en una fuente autorizada. El adaptador local de demostración usa almacenamiento del navegador y operaciones genéricas. Sus resultados prueban comportamiento de interfaz dentro del ensayo. [Gestión](../../apps/web/src/features/ceremonias/GestionEventos.jsx#L53-L93), [registro](../../apps/web/src/features/graduandos/RegistroGraduando.jsx#L171-L220), [adaptador local](../../apps/web/src/integrations/base44/localEntities.js), [línea base](../engineering/BASELINE.md)

## 12. Casos de prueba y escenarios negativos

| Caso | Resultado esperado para el núcleo propuesto |
| --- | --- |
| Alta con varias ceremonias y fallo de una | El evento y sus sesiones se guardan juntos en éxito. Ante fallo, se revierte el conjunto. El conteo deriva de las filas guardadas. |
| Sede ajena, ceremonia cruzada, ID inexistente o evento inactivo | Rechazar antes de crear registros, adjuntos o efectos. Proteger la existencia de recursos fuera de alcance. |
| Alta y cierre simultáneo de la programación | La transacción comprueba el estado vigente y conserva solo el resultado permitido por el orden efectivo de operaciones. |
| Graduando válido en dos eventos y doble alta en una ceremonia | Una identidad y un registro por ceremonia válida. Doble alta con claves distintas conserva un vínculo. Las diferencias incompatibles generan conflicto. |
| Homónimos y contacto compartido | Mantener separados los perfiles de personas distintas. Una identidad ambigua queda en revisión sin habilitar acceso. |
| Comprador tercero, inscripción sin venta y legado `completo` por precio cero | Mantener separados al participante, al comprador y al actor de captura. Inscribir jamás confirma venta, pago o demanda. Conciliar la evidencia legada. |
| Mismo `operation_id` en paralelo, pérdida de respuesta y contenido distinto | Una escritura y una intención de envío. Un reintento idéntico recupera el resultado autorizado, y contenido distinto devuelve `409`. Un fallo revertido admite reintento. |
| Sesión vencida, cuenta suspendida o permiso revocado | Rechazar el envío y la recuperación de resultados protegidos. Conservar el actor original. |
| Colaborador consulta registros ajenos o suplanta `colaborador_id`, o un usuario coincide con el nombre de una institución | Denegar según rol o ámbito. Probar listados, conteos e IDs directos, incluso con varios roles. |
| Histórico sin ceremonia, con vínculos cruzados o actor sin verificar | Preservar procedencia con acceso restringido. Excluir de participaciones válidas y demanda mientras se resuelve. |
| Fila antigua duplicada, importación repetida y conciliación comercial posterior | Conservar referencias de origen. Contar una participación canónica y deduplicar cada unidad productiva por su clave comercial aprobada. |
| Restaurar con vínculo válido, duplicado activo o ceremonia retirada | Restaurar solo si estado, autorización y unicidad lo permiten. En conflicto se conserva el historial. |
| Fallo de correo tras guardar | El registro sigue consultable y se recupera el efecto sin crear otra inscripción. |
| Corte interrumpido antes o después de escrituras nuevas | Conservar un solo escritor y comprobar que conciliar el delta y revertir no produce copias. |

Las suites existentes cubren el [vínculo de ceremonias](../../tests/vinculo-ceremonias.mjs) y la [papelera](../../tests/papelera-graduandos.mjs) con datos ficticios. Incluyen cambios de selección, validación antes de guardar, histórico sin ceremonia, confirmación simulada y restauración. Los casos del núcleo son criterios futuros de aceptación.

## 13. Decisiones confirmadas y pendientes con Ernesto

**Confirmadas.** V1 abarca eventos, ceremonias y registros de graduandos. Están aprobados siete roles y la matriz queda abierta. ME-E0 exige mínimo privilegio, evitar duplicados de graduandos y demanda, impedir atribuciones arbitrarias y acceso institucional por nombre, separar inscripción de venta pagada y prever reintentos de la PWA. Administrador y Colaborador son los roles actualmente habilitados en los paneles Laravel. [Alcance V1](ME-SCOPE-V1.md), [sesión](../engineering/AUTENTICACION.md)

| Decisión abierta | Validación requerida |
| --- | --- |
| Institución y sede | Identificador oficial, quién valida equivalencias históricas, si la sede es obligatoria y si un evento puede abarcar varias sedes. |
| Programación y ciclo | Rango de ceremonias, días y huso horario, estados, transiciones, responsables y efectos de cancelación o reprogramación. |
| Graduandos, compradores y usuarios | Identificador y ámbito de unicidad, manejo de contactos compartidos y menores, canal de verificación, consolidación, vínculo de cuentas y representación por terceros. |
| Participación | Varias ceremonias en el mismo evento, traslados, reinscripción, baja lógica, restauración y manejo de históricos incompletos. |
| Permisos y atribución | Ámbitos por rol, alta y revocación de vínculos, verificación de representantes, atribución de históricos y permisos de exportación y adjuntos. |
| Venta, pago y demanda | Quién confirma venta y recaudo, reglas de abonos, sobrepagos, importes y conciliación, comprador histórico desconocido, unidad de demanda y qué la activa o revierte. |
| Migración y auditoría | Responsables, umbrales de conciliación, manejo de adjuntos, retención de datos e idempotencia, eventos auditables, ventana de corte y reversión. |

## 14. Alta pública de Graduandos

**Regla provisional de ME-REG1A.** El correo verificado identifica la cuenta de acceso. El registro guarda nombres, apellidos, teléfono y, si el graduando lo declara, tipo y número de documento. La verificación confirma control del correo. El documento queda como dato declarado. La cuenta tiene exclusivamente el rol Graduando y carece de permisos operativos. El alta no crea un perfil operativo, una inscripción ni una transacción comercial. Cualquier vínculo futuro requiere autorización y evidencia, incluso cuando ya existe una persona con los mismos datos. [Contrato técnico](../engineering/ME-REG1A.md)

**Preguntas para el domingo con Ernesto.**

| Tema | Decisión pendiente |
| --- | --- |
| Documento e identidad | ¿Hace falta el documento para una cuenta básica? ¿Para qué finalidad, cuándo se solicita, quién puede consultarlo y cuándo se elimina? |
| Menores y representantes | ¿Cómo se acredita la representación cuando se necesita y cómo se resuelven correos compartidos, cambios de correo y duplicados históricos? |
| Ceremonias e históricos | ¿Quién autoriza el vínculo, con qué evidencia y cómo se revisan las coincidencias o participaciones ambiguas? |
| Portal y operación | ¿Qué podrá consultar la cuenta después del vínculo? ¿Quién atiende la recuperación, el abuso y los problemas de entrega? ¿Qué avisos, consentimiento y plazos de conservación se requieren? |
| Institución y comercio | ¿Quién verifica a la institución y a sus representantes? ¿Cómo se separan la participación, la venta, el recaudo y la demanda? |

## 15. Solicitud y aprobación institucional

**Regla provisional de ME-REG2A.** Una persona puede pedir la representación de un colegio o una universidad desde `/registro/institucion`. El resultado es una solicitud `pendiente`. No crea acceso institucional, no inscribe graduandos y no abre ventas ni pagos. El representante nuevo define su contraseña en `/activar-institucion` después de la aprobación. El contrato técnico está en [ME-REG2A](../engineering/ME-REG2A.md).

### Estados

| Estado | Significado |
| --- | --- |
| `pendiente` | El correo ya se verificó, o la cuenta existente y verificada confirmó la solicitud en su sesión. Espera decisión. |
| `aprobada` | Un administrador activo registró la aprobación. Existen la institución, la sede y el vínculo. El acceso solo queda utilizable si el flujo verificado ya terminó. |
| `rechazada` | Un administrador activo registró un motivo. No hay institución nueva, vínculo ni rol nuevo. |

La notificación de la decisión tiene su propio estado: `pendiente`, `enviando`, `enviada` o `fallida`. Un fallo de correo no devuelve la decisión a `pendiente`.

### Transiciones

- Una solicitud `pendiente` puede aprobarse o rechazarse una sola vez.
- Aprobar o rechazar ocurre en una transacción. El correo se encola después de confirmarla.
- No se puede rechazar una solicitud `aprobada`. No hay todavía un procedimiento de revocación.
- Un representante nuevo solo recibe el rol `institucion` y un vínculo `activo` cuando define su contraseña con el enlace de un solo uso.
- Una cuenta que ya existía y tenía el correo verificado conserva sus roles. La aprobación agrega `institucion` y activa el vínculo, sin cambiar la contraseña.

### Colegio, universidad y representante

`colegio` y `universidad` comparten este flujo. El tipo describe la institución y todavía no cambia los permisos. La sede nace con la aprobación y pertenece solo a esa institución. El representante es la persona de la solicitud. El rol `institucion` no alcanza por sí solo: hace falta un vínculo `activo` con esa institución. Sin ese par, no hay acceso a eventos, graduandos, ventas, pagos ni datos de otra institución.

No se vincula una solicitud a una institución existente porque coincidan el nombre, el NIT o el dominio del correo. Si el NIT ya está registrado, la aprobación se detiene, la solicitud sigue `pendiente` y no se duplica la institución.

### Permisos

Solo un administrador activo decide. Colaborador, Graduando y los demás roles no aprueban ni rechazan. El cliente no puede enviar roles, usuario o institución de destino. Las reglas operativas de eventos y registros no se ampliaron.

### Preguntas adicionales para Ernesto

| Tema | Decisión pendiente |
| --- | --- |
| NIT | ¿El guion debe ser obligatorio? Hoy se conserva el texto y se admite un solo guion opcional entre dos grupos de dígitos, como el formulario ya aprobado. |
| Varios representantes | ¿Una institución puede tener más de un representante y una persona puede representar más de una institución? Hoy hay como máximo una solicitud pendiente o aprobada por correo. |
| Correo | ¿El correo del representante debe pertenecer a un dominio de la institución? Hoy no se exige. |
| Cuenta sin verificar | ¿Qué camino tiene una cuenta ya creada cuyo correo todavía no está verificado? Hoy no puede usar el alta pública ni la sesión. |
| Sede | ¿La sede es siempre obligatoria y una solicitud puede declarar varias? Hoy se exige una. |
| Revocación | ¿Quién puede retirar una aprobación ya activada, con qué motivo y qué pasa con la sesión? Hoy no existe esa acción. |
| Sesión visible | ¿Debe mostrarse Institución junto con los paneles de roles internos? ME-REG2B permite elegir entre Graduando e Institución cuando el vínculo está activo. Los roles internos mantienen su prioridad. |
| Correo y enlace | ¿Se mantienen el asunto, el texto y los 30 minutos del enlace de activación? |

## 16. Vinculación provisional de la cuenta de Graduando

**Regla provisional de ME-PORT1B1.** La cuenta de acceso, la persona graduando y la inscripción a una ceremonia siguen siendo relaciones distintas. El comprador tampoco se deriva de este vínculo. Una coincidencia de correo, documento, nombre o teléfono no vincula, no fusiona personas y no concede acceso. Si dos registros parecen la misma persona, permanecen separados hasta una revisión por identificador.

Solo un administrador activo confirma la relación. La cuenta debe tener el rol Graduando, estar activa y tener el correo verificado. El graduando operativo ya debe existir. La decisión guarda el administrador responsable y la fecha. El mismo par no puede repetirse. Como la cardinalidad sigue abierta, una cuenta ya vinculada o un graduando ya vinculado no reciben un segundo acceso: la nueva relación queda sin conceder y pendiente de revisión.

La operación no cambia inscripciones, pagos ni la `RegistroPolicy`. Anular o corregir un vínculo conserva la fila, exige un motivo y registra al administrador y la fecha. El acceso activo anterior queda retirado. Las inscripciones siguen en su ceremonia: trasladar una inscripción es una rectificación operativa aparte y no se hace desde esta corrección. El portal de Graduandos todavía no consulta sus ceremonias.

### Preguntas para Ernesto

| Tema | Decisión pendiente |
| --- | --- |
| Cardinalidad | ¿Una cuenta puede representar varios graduandos y un graduando puede tener varias cuentas? Hoy un segundo acceso no se concede. |
| Evidencia | ¿Qué documento, lista o participación debe ver el administrador antes de confirmar? Hoy compara los identificadores y los nombres, sin consultar el número de documento. |
| Homónimos | ¿El nombre compartido exige una evidencia adicional o basta el identificador elegido? Hoy no se fusionan y el aviso queda en la revisión. |
| Revocación | La anulación retira el acceso activo, conserva la evidencia y no cierra la sesión de la cuenta. ¿Debe también cerrar la sesión? |
| Traslado | ¿Una corrección de identidad puede mover inscripciones a otra ceremonia? Hoy no. Queda para una fase de rectificación operativa. |
| Consulta del portal | ¿Qué ceremonias e inscripciones puede ver la cuenta después del vínculo? Hoy el portal no las muestra. |
