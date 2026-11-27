# Identidad y temas de MasterExpress Control

## Identidad

- Se usa el logotipo del sitio corporativo (`assets/img/logo.png`), ya incorporado como `apps/web/public/master-express.png`. Ambos archivos tienen el mismo SHA-256.
- La hoja `assets/styles.css` del sitio corporativo aporta tinta `#16181D`, papel `#FBFAF7`, neutros oscuros `#121417` y `#1B1E23`, y dorados `#9A6B34` y `#E7C797`. En Claro, el dorado #B48338 identifica la marca y las acciones principales, con tinta #16181D en los botones. Los textos interactivos usan #8C602A sobre superficies claras y los acentos usan #E9D8BF. El fondo es #FBFAF7 y las tarjetas, los desplegables y los bordes conservan sus neutros.
- Las variantes de interfaz y los colores de estado son una propuesta provisional.

## Tipografía

Inter es la familia de interfaz para cuerpo, encabezados y controles. `--font-interfaz` define `Inter, Arial, sans-serif` y alimenta los alias `font-body` y `font-heading` de Tailwind. Se conservan la escala existente y los pesos 400 para contenido, 500 para etiquetas, 600 para énfasis y 700 para títulos e indicadores. Los indicadores usan `tabular-nums` para alinear las cifras.

La auditoría anterior al cambio encontró Inter renderizada desde Google Fonts en Chrome y Arial cuando se bloqueó esa red, aunque `getComputedStyle` seguía declarando Inter. DM Sans cubrió las muestras de texto del acceso y midió cerca de Inter en las etiquetas de 14 px. Se conservó Inter por continuidad con las vistas aprobadas, su legibilidad a tamaños de interfaz y sus cifras tabulares.

Se sirve un solo WOFF2 latino variable de Inter v20 desde el mismo origen, con precarga y `font-display: optional`. Si el archivo no está disponible al pintar, se conserva el fallback durante esa navegación para evitar un salto tardío. El archivo original procede de [Google Fonts](https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2) y se distribuye con [su licencia OFL 1.1](../../apps/web/public/fuentes/inter-OFL.txt). Las plantillas de correo heredadas conservan su tipografía propia.

## Tokens semánticos

| Uso | Tokens CSS |
| --- | --- |
| Página, tarjetas y contenido en portales | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground` |
| Texto de apoyo y superficies atenuadas | `muted`, `muted-foreground` |
| Acciones, enlaces y selección | `primary`, `primary-foreground`, `interactivo`, `primary-suave`, `primary-suave-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground` |
| Bordes, campos y foco | `border`, `input`, `ring` |
| Éxito, advertencia, error y acción destructiva | `exito`, `aviso`, `error`, sus variantes `-suave`, `destructive`, `destructive-foreground` |
| Marca y navegación | `marca-placa` y familia `sidebar-*` |

Los tokens se aplican en `html`. Menús, selectores y diálogos de Radix heredan la misma paleta cuando montan su contenido en portales. Las reglas locales del panel ajustan distribución, selección activa y foco. Los estados combinan texto con indicadores visuales.

## Preferencia de tema

- `ProveedorTema` monta una instancia de `next-themes` sobre toda la app usando la dependencia ya instalada. `SelectorTema` reutiliza el menú de radio shadcn/Radix en el acceso y la cabecera de ambos paneles.
- El botón de 44 × 44 px muestra un sol, una luna o un monitor según la preferencia elegida. El botón anuncia el modo y ofrece una ayuda al pasar el puntero en escritorio. El menú usa texto, iconos e indicador de selección, con navegación por teclado y retorno del foco al cerrar con Escape. Los tooltips compartidos se muestran al pasar el puntero o al recibir foco visible. El retorno automático del foco desde un menú conserva el foco sin volver a mostrar el tooltip.
- Claro y Oscuro fijan la apariencia. Sistema es el valor inicial y sigue los cambios de `prefers-color-scheme` en vivo. La clave visual `theme` conserva `light`, `dark` o `system`, incluidos los dos valores del control previo.
- El inicio de `index.html` establece la clase `dark` y `color-scheme` antes de cargar React. Si el servidor entrega una política CSP restrictiva, debe autorizar ese script por hash o nonce. El tema se aplica sin remontar el proveedor de sesión. Las transiciones CSS se suspenden durante el cambio de tema para aplicar los nuevos colores en el mismo ciclo de renderizado.

## Acceso unificado

El acceso usa un marco compartido para el ingreso, la recuperación, el restablecimiento y la selección de panel. Desde 1024 px, una tarjeta de hasta 960 px ubica la marca a la izquierda y el contenido a la derecha. La separación es curva desde 1024 px, independientemente del dispositivo de entrada. En pantallas más estrechas, la marca pasa a una cabecera con borde inferior recto y la tarjeta queda en una columna de hasta 576 px.

La composición se conserva en ambos temas. Claro combina marfil con neutros cálidos y Oscuro usa fondo #121417 y tarjeta #1B1E23. El dorado #B48338 define el relieve y el borde del panel. En Claro, la acción principal del acceso usa ese dorado con texto #16181D y los enlaces usan #8C602A. El logotipo original conserva su placa marfil y lleva el descriptor «Cada ceremonia, organizada de principio a fin.». La trama de puntos y la iluminación radial son estáticas y se limitan al fondo exterior.

El formulario mantiene las etiquetas persistentes, el foco visible y las zonas táctiles de al menos 44 px. El enlace de recuperación está debajo del campo de contraseña. «Mantener sesión iniciada» comienza desmarcada. Los avisos de error, advertencia, información y confirmación combinan icono, texto y tokens semánticos. Las transiciones de los controles respetan la preferencia de movimiento reducido.

## Registro público

«Soy graduando» abre /registro/graduando y «Soy institución» abre /registro/institucion. Ambas vistas usan el marco de acceso. Validan los campos por paso, conservan los valores al retroceder y permiten editar cada apartado desde la revisión.

- Graduando incluye datos personales, contraseña y verificación por correo. Al continuar con los campos de acceso válidos se solicita el código una vez para el correo indicado. Se enmascara el destino, se enfoca el campo del código y el reenvío respeta la espera del servicio. El documento es opcional. El selector ofrece Cédula de ciudadanía o Tarjeta de identidad y conserva el número como texto con dígitos del 0 al 9. [Flujo de registro y portal](ME-REG1B.md)
- Institución incluye razón social, NIT, sede y datos del contacto responsable. El NIT se conserva como texto con dígitos del 0 al 9 y admite un guion entre dos grupos de dígitos. La verificación y el envío aparecen pendientes. La aprobación corresponde a un administrador autorizado.
- El documento y el NIT son datos declarados. La verificación de identidad o representación requiere un proceso separado. Los datos que aún están en el formulario se descartan al salir. El resumen oculta la contraseña y parte del número del documento. La acción final de Institución sigue deshabilitada.

### Decisiones pendientes con Ernesto

- Confirmar si se necesita el documento del graduando, con qué finalidad y en qué momento se pide. Definir cómo se autoriza la vinculación con la ceremonia.
- Confirmar los datos mínimos, la verificación de representación institucional y el procedimiento que seguirá el administrador autorizado para aprobar o rechazar una solicitud.
- Acordar habilitación de cuentas, permisos aplicados en servidor, notificaciones, conservación de datos, auditoría y protección contra abuso antes de habilitar envíos.

## Estructura y componentes

- `PanelOperativo` comparte el encabezado, el perfil y la navegación. El Administrador conserva sus vistas internas y el Colaborador mantiene las rutas `/ColaboradorDashboard` y `/RegistroGraduando`.
- El portal de Graduandos reutiliza la cabecera, la navegación y el selector de tema del panel. Inicio informa que la vinculación a ceremonias requiere autorización aparte. Mi perfil muestra el nombre, el correo y el estado de verificación de la sesión. El menú de cuenta permite abrir el perfil y cerrar sesión.
- La navegación lateral permanece visible desde 1024 px. En anchos menores, `Sheet` abre el menú, confina el foco y lo devuelve al activador al cerrar. La sección activa se marca con texto, indicador visual y `aria-current`.
- `IndicadoresPanel` presenta las métricas de ambas pantallas con una lista de definiciones. Las tarjetas se distribuyen en dos columnas en móvil y cuatro a partir de 640 px.
- Los estados del panel indican en texto si hay una consulta en curso, un error recuperable o una lista vacía. El detalle del Colaborador usa los mismos tokens globales para los estados y conserva el texto que distingue cada estado.
- La estructura incluye un enlace de salto, foco visible, controles principales de 44 px y soporte para la preferencia de movimiento reducido. La página permite ampliar con zoom.

## Alcance pendiente

La revisión de contraste cubre muestras del ingreso, la cabecera, la navegación, los menús y los indicadores. La validación AA completa y la actualización visual de clases heredadas en módulos internos quedan pendientes.
