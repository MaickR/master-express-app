# Estándares de ingeniería

La base actual usa React/JSX, Vite y Base44. React con TypeScript estricto y Laravel son objetivos de evolución. Cada migración, actualización mayor o incorporación de dependencias requiere autorización.

## Principios

- Aplique DRY, KISS, YAGNI y SOLID de forma proporcional al problema. Separe responsabilidades, prefiera soluciones pequeñas y reutilice componentes y reglas de dominio compartidas.
- Aplique seguridad por defecto y Fail Fast. Rechace entradas inválidas en el límite correspondiente antes de producir efectos y devuelva errores útiles sin exponer detalles sensibles.
- Mantenga una fuente de verdad por dato. Diseñe operaciones repetibles o reintentables con idempotencia y preserve la consistencia ante fallos parciales. Mantenga las reglas de dominio aislables y comprobables.

## Idioma, nombres y comentarios

- Use español de Colombia en el código de dominio, los identificadores propios, los comentarios y la documentación. Evite tildes en identificadores y conserve los nombres obligatorios de frameworks y librerías.
- Use `camelCase` para variables y funciones, `PascalCase` para clases y componentes y `UPPER_SNAKE_CASE` para constantes globales. Use `kebab-case` en archivos y directorios nuevos cuando corresponda, y `snake_case` en tablas y columnas propias. Respete las convenciones requeridas por frameworks y herramientas. Evite renombrados automáticos del código existente.
- Documente decisiones, restricciones de negocio y contratos. Use JSDoc o PHPDoc cuando aclaren entradas, salidas, efectos o errores. Omita comentarios que repitan instrucciones del código o describan funciones triviales.
- Use las marcas de Better Comments según el propósito del comentario.

```text
// * Información importante.
// ! Advertencia crítica.
// TODO: Tarea concreta pendiente.
// ? Cuestión por revisar.
```

## Reglas de interfaz y datos para nuevas fases

- Explique las acciones al usuario con términos del dominio. Reserve los detalles de Base44, Laravel, QA e infraestructura para documentación técnica.
- Use acciones compactas con texto comprensible, foco visible y un área táctil suficiente. Verifique el contraste en Claro, Oscuro y Sistema.
- Valide entradas numéricas según el dominio tanto en React como en Laravel. Compruebe unidad, rango, precisión y condiciones transversales antes de persistir.
- En listados extensos, reutilice búsqueda, filtros y paginación. Aplique los filtros y los límites en el servidor.
- Defina métricas con una fuente autoritativa, reglas compartidas y unidades coherentes entre pantallas.

## React, TypeScript y formularios

- Migre de JSX a TSX de forma incremental cuando se autorice. Avance hacia TypeScript estricto y justifique cualquier uso de `any`.
- Reutilice componentes accesibles con responsabilidades claras. Llame los Hooks en el nivel superior, gestione las dependencias de los efectos y limpie suscripciones y solicitudes cuando corresponda.
- Derive valores cuando sea posible y evite duplicar estado y solicitudes. Defina estados de carga, vacío, éxito y error recuperable. Capture errores en el límite adecuado y use carga diferida donde aporte valor.
- Use etiquetas persistentes, instrucciones concretas y errores asociados al campo. Valide según el contexto antes de enviar y vuelva a validar en la capa de servidor que persiste los datos. Conserve la entrada ante errores recuperables y evite envíos duplicados.

## Estilos y accesibilidad

- Diseñe primero para teléfono y compruebe también tableta y escritorio. Mantenga accesibles las acciones con zoom, textos largos y tablas anchas.
- Reutilice Tailwind y los componentes shadcn/ui existentes. Use tokens visuales semánticos para los modos claro y oscuro y evite sistemas de estilos duplicados. Use BEM en CSS o SCSS personalizado cuando ayude. Evite imponer `font-size: 62.5%` global.
- Tome WCAG AA como objetivo. Use HTML semántico, nombres accesibles, orden de tabulación lógico, foco visible y tamaños táctiles adecuados. Compruebe teclado y foco en diálogos. Acompañe el color con texto o un indicador equivalente.

## Laravel y PHP

- Aplique PSR-12 y las convenciones oficiales de Laravel cuando se implemente el backend. Use Eloquent con relaciones explícitas y prevenga consultas N+1. Use Form Requests para validación y Policies o Gates para autorización.
- Versione las migraciones y use transacciones en operaciones críticas. Use jobs, colas y notificaciones cuando el proceso lo justifique. Evite paquetes o capas innecesarias.

## Base de datos, finanzas y auditoría

- Use claves foráneas, restricciones de integridad, índices justificados y consultas parametrizadas. Proteja las operaciones concurrentes y separe los datos reales de los de pruebas.
- Represente importes exactos. Comparta las reglas acordadas de cálculo y redondeo entre operaciones, vistas y reportes y compruébelas con resultados esperados. Preserve movimientos históricos sensibles y registre los ajustes como movimientos nuevos cuando la regla de negocio lo contemple.
- Audite operaciones importantes con actor, fecha, acción y referencia mínima. Valide con el responsable qué eventos registrar, quién puede consultarlos y cuánto tiempo conservarlos.

## Seguridad

- Mantenga credenciales fuera del código y de Git. Valide autenticación y permisos en servidor y aplique mínimo privilegio por usuario, operación y recurso.
- Proteja contra CSRF y XSS según el contexto. Valide entradas y archivos en los límites de confianza. Evite datos sensibles innecesarios en logs, errores, clientes y exportaciones.
- V1 se mantiene sin MFA según el [alcance aprobado](../product/ME-SCOPE-V1.md). No use la autenticación insegura de la base actual de Base44 con usuarios ni datos empresariales reales.

## QA

- Use pruebas unitarias, de integración y de navegador según el riesgo. Cubra flujos normales y regresiones entre módulos y roles, incluidos permisos, persistencia y cálculos cuando se vean afectados.
- Ejecute de forma autónoma las comprobaciones autorizadas. Reserve la intervención del titular para credenciales privadas y decisiones de aceptación.
- Aísle las pruebas automatizadas del almacenamiento persistente de aceptación y use datos ficticios. No modifique datos reales durante QA ni altere pruebas para ocultar fallos. Genere artefactos de compilación o prueba solo en rutas autorizadas.
- Registre comando, alcance, resultado y limitaciones. Use **PASS** para una comprobación satisfactoria, **FAIL** ante un resultado incorrecto, **BLOCKED** cuando una condición impide comprobar y **NOT TESTED** cuando la comprobación no se ejecutó. Declare verificadas únicamente las funciones probadas.

## Git y agentes

- Aplique [AGENTS.md](../../AGENTS.md) al inicio de cada tarea. Revise estado, exclusiones y cambios ajenos. Prepare cambios acotados y revise los nombres, el diff y el contenido antes del commit. Mantenga secretos y artefactos generados fuera de Git.
- Use Conventional Commits en español con un encabezado de máximo 72 caracteres y ramas de nombre corto y descriptivo. Tras la línea base, integre por PR y evite el push directo ordinario a `main` y `develop`. Haga rebase solo si es seguro y no afecta trabajo compartido sin coordinación.
- Use versionado semántico y actualice el `CHANGELOG` en las publicaciones de versiones. Mantenga LF en archivos de texto y conserve los binarios mediante las reglas de `.gitattributes`.
- Confirme por separado la autorización de commit, push, PR, merge y deploy, además de las demás operaciones enumeradas en la guía para agentes.
