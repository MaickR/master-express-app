# Alcance de producto V1

## Decisiones aprobadas

MasterExpress Control se orienta a la operación de ceremonias de grado. El catálogo de V1 incluye exactamente estos siete roles:

- Administrador
- Colaborador
- Vendedor
- Finanzas
- Inventario
- Graduando
- Institución

V1 se entrega sin autenticación multifactor (MFA). La matriz de permisos de estos roles queda por validar con Ernesto.

## Funcionalidad base de V1

- Gestionar ceremonias y eventos.
- Registrar graduandos y consultar la información de su operación.
- Gestionar ventas, gastos, resúmenes financieros y reportes básicos.
- Considerar los flujos de inventario e institución dentro del levantamiento de V1. Su alcance operativo y sus acciones quedan por validar.

El alcance describe el producto. La [línea base técnica](../engineering/BASELINE.md) identifica las capacidades observadas en el código y las verificaciones pendientes.

## Reglas globales de diseño

- Aplicar mínimo privilegio y proteger el acceso a los registros y datos personales.
- Mantener consistencia entre registros operativos, datos financieros y reportes.
- Mantener trazabilidad de cambios sensibles y validar con el responsable qué eventos deben quedar registrados.
- Usar español de Colombia para los textos del producto y los términos del dominio.

## Fases posteriores

- Fotografía avanzada y reconocimiento facial.
- Evolución a SaaS.

## Decisiones provisionales para validar con Ernesto

Las agrupaciones de funcionalidad sirven para conversar sobre V1. No asignan permisos ni cierran estas decisiones:

- Matriz de permisos por rol, alcance de los registros visibles y acciones que requieren aprobación.
- Alta de usuarios, registro de graduandos, recuperación de acceso y participación de las instituciones.
- Estados y transiciones de ceremonias, ventas y pagos, manejo de excepciones y responsables de cada paso.
- Cálculo y redondeo de importes, ajustes y conciliación, junto con el detalle de los reportes y sus responsables.
- Flujo de inventario, movimientos, asignaciones y relación con la operación de las ceremonias.
- Eventos de auditoría, acceso a reportes y exportaciones, y conservación de datos.
