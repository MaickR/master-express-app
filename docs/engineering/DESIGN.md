# Identidad y temas de MasterExpress Control

## Identidad

- Se usa el logotipo del sitio corporativo (`assets/img/logo.png`), ya incorporado como `apps/web/public/master-express.png`. Ambos archivos tienen el mismo SHA-256.
- La hoja `assets/styles.css` del sitio corporativo aporta tinta `#16181D`, papel `#FBFAF7`, neutros oscuros `#121417` y `#1B1E23`, y dorados `#9A6B34` y `#E7C797`. El dorado claro destaca la marca y el destino activo. La acción principal usa un marrón más oscuro en modo claro para sostener el contraste con el texto blanco.
- Las variantes de interfaz y los colores de estado son una propuesta provisional. Se conserva Inter con alternativa local sans serif.

## Tokens semánticos

| Uso | Tokens CSS |
| --- | --- |
| Página, tarjetas y contenido en portales | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground` |
| Texto de apoyo y superficies atenuadas | `muted`, `muted-foreground` |
| Acciones y selección | `primary`, `primary-foreground`, `primary-suave`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground` |
| Bordes, campos y foco | `border`, `input`, `ring` |
| Éxito, advertencia, error y acción destructiva | `exito`, `aviso`, `error`, sus variantes `-suave`, `destructive`, `destructive-foreground` |
| Marca y navegación | `marca-placa` y familia `sidebar-*` |

Los tokens se aplican en `html`. Menús, selectores y diálogos de Radix heredan la misma paleta cuando montan su contenido en portales. Las reglas locales del panel ajustan distribución, selección activa y foco. Los estados combinan texto con indicadores visuales.

## Preferencia de tema

- `ProveedorTema` monta una instancia de `next-themes` sobre toda la app usando la dependencia ya instalada. `SelectorTema` reutiliza el menú de radio shadcn/Radix en el acceso y la cabecera de ambos paneles.
- Claro y Oscuro fijan la apariencia. Sistema es el valor inicial y sigue los cambios de `prefers-color-scheme` en vivo. La clave visual `theme` conserva `light`, `dark` o `system`, incluidos los dos valores del control previo.
- El inicio de `index.html` establece la clase `dark` y `color-scheme` antes de cargar React. Si el servidor entrega una política CSP restrictiva, debe autorizar ese script por hash o nonce. El tema se aplica sin remontar el proveedor de sesión.

## Acceso unificado

El ingreso usa una sola superficie centrada de hasta 576 px. La cabecera integra el logotipo original, el nombre del producto y el selector de tema. La placa del logotipo conserva el fondo claro corporativo para mantener legible el archivo original en ambos modos. El fondo, la cabecera, el formulario y su menú se derivan de los tokens del tema.

El formulario mantiene etiquetas persistentes, controles de 48 a 56 px, foco visible y avisos asociados a los campos. En pantallas estrechas, la cabecera y el formulario siguen el mismo orden y el selector mantiene su nombre accesible.

Cuando existan los servicios correspondientes, «¿Olvidaste tu contraseña?» se ubicará junto a la etiqueta Contraseña y «Mantener sesión iniciada» irá debajo del campo, antes de la acción principal. Las acciones de institución y graduando podrán agruparse debajo del formulario como accesos externos, con un separador y espacio para apilarse en móvil. Estas ubicaciones quedan reservadas en el diseño sin mostrar controles inactivos.

## Estructura y componentes

- `PanelOperativo` comparte el encabezado, el perfil y la navegación. El Administrador conserva sus vistas internas y el Colaborador mantiene las rutas `/ColaboradorDashboard` y `/RegistroGraduando`.
- La navegación lateral permanece visible desde 1024 px. En anchos menores, `Sheet` abre el menú, confina el foco y lo devuelve al activador al cerrar. La sección activa se marca con texto, indicador visual y `aria-current`.
- `IndicadoresPanel` presenta las métricas de ambas pantallas con una lista de definiciones. Las tarjetas se distribuyen en dos columnas en móvil y cuatro a partir de 640 px.
- Los estados del panel indican en texto si hay una consulta en curso, un error recuperable o una lista vacía. El detalle del Colaborador usa los mismos tokens globales para los estados y conserva el texto que distingue cada estado.
- La estructura incluye un enlace de salto, foco visible, controles principales de 44 px y soporte para la preferencia de movimiento reducido. La página permite ampliar con zoom.

## Alcance pendiente

La revisión de contraste cubre muestras del ingreso, la cabecera, la navegación, los menús y los indicadores. La validación AA completa y la actualización visual de clases heredadas en módulos internos quedan pendientes.
