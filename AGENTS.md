# Guía para agentes de MasterExpress Control

## Inicio y fuentes de verdad

- Lea este archivo al inicio de cada tarea. La instrucción vigente del responsable define el alcance y la autorización. Consulte solo las fuentes pertinentes: [alcance V1](docs/product/ME-SCOPE-V1.md), [línea base técnica](docs/engineering/BASELINE.md) y [estándares de ingeniería](docs/engineering/STANDARDS.md). Verifique las afirmaciones sobre la aplicación actual con el código correspondiente.
- Si las fuentes difieren, documente la discrepancia y confirme la decisión con el responsable antes de implementar la parte afectada. Distinga el código actual en React/JSX y Base44 de los objetivos React/TypeScript y Laravel.

## Alcance, seguridad y Git

- Confirme raíz, estado de Git, archivos existentes y exclusiones. Defina las rutas escribibles para la tarea. Trate el resto como solo lectura y preserve los archivos y cambios del usuario. Detenga la operación afectada si hay riesgo de pérdida, exposición o conflicto.
- Evite scaffolding innecesario. No amplíe funcionalidades, instale paquetes o herramientas, cambie dependencias, ejecute migraciones ni reemplace archivos sin autorización explícita. No ejecute acciones destructivas.
- Mantenga secretos y datos personales fuera del código, las muestras, los logs y los informes. No lea, copie ni imprima valores de archivos de entorno durante el preflight. Use datos ficticios en QA y compruebe las exclusiones antes de proponer archivos para Git.
- Trate la inicialización, la creación de ramas, el staging, el commit, la configuración de remotos, el push, el PR, el merge y el deploy como autorizaciones separadas. Use rutas explícitas para el staging autorizado.

## Convenciones, QA y cierre

- Use español de Colombia para el dominio y aplique los principios y convenciones de [STANDARDS](docs/engineering/STANDARDS.md). Reutilice patrones existentes cuando resuelvan la tarea.
- Registre puntos de control al cerrar el preflight, después de ejecutar las operaciones autorizadas y al verificar la entrega. Compare los cambios observados con el alcance permitido.
- Registre comandos, resultados y limitaciones con PASS, FAIL, BLOCKED o NOT TESTED. Mantenga visibles los fallos y distinga funciones probadas de las pendientes.
- Separe hechos, hallazgos heredados, supuestos, propuestas y decisiones pendientes. Informe cambios, pruebas, riesgos y estado Git. Cierre con GO, NO-GO o BLOCKED y deténgase en el punto de control solicitado.
