# Interfaz base de MasterExpress Control

## Identidad

- Se incorporó el logotipo del sitio corporativo (`assets/img/logo.png`) como recurso local `public/master-express.png`. La cabecera usa el nombre MasterExpress Control.
- La navegación conserva el azul oscuro de los tokens existentes de la aplicación. El dorado del sitio corporativo resalta el nombre Control y la sección activa.
- Se conserva Inter, con sustitución local por una fuente sin serifas. Los encabezados distinguen la pantalla, los indicadores y los accesos de operación.

## Estructura y componentes

- `PanelOperativo` comparte el encabezado, el perfil y la navegación. El Administrador conserva sus vistas internas y el Colaborador mantiene las rutas `/ColaboradorDashboard` y `/RegistroGraduando`.
- La navegación lateral permanece visible desde 1024 px. En anchos menores, `Sheet` abre el menú, confina el foco y lo devuelve al activador al cerrar. La sección activa se marca con texto, indicador visual y `aria-current`.
- `IndicadoresPanel` presenta las métricas de ambas pantallas con una lista de definiciones. Las tarjetas se distribuyen en dos columnas en móvil y cuatro a partir de 640 px.
- Los tokens `--panel-accion`, `--panel-exito`, `--panel-aviso` y sus variantes suaves tienen valores para tema claro y oscuro. Su alcance se limita al panel y a su menú. Los estados indican en texto si hay una consulta en curso, un error recuperable o una lista vacía.
- La estructura incluye un enlace de salto, foco visible, controles de cabecera de 44 px y soporte para la preferencia de movimiento reducido. La página permite ampliar con zoom.

## Alcance pendiente

La revisión de contraste se concentra en la estructura y las tarjetas nuevas. La validación AA completa y la actualización visual de los módulos internos requieren una revisión independiente.
