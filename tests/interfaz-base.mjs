// node tests/interfaz-base.mjs "ruta al ejecutable de Chrome o Edge" ["carpeta de capturas"]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as esperarMs } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const [navegador, capturas] = process.argv.slice(2);
assert(navegador, "Indica la ruta al ejecutable de Chrome o Edge.");
const proyecto = fileURLToPath(new URL("..", import.meta.url));
const archivoCss = join(proyecto, "src", "index.css");
const [css, html, logo] = await Promise.all([
  readFile(archivoCss, "utf8"),
  readFile(join(proyecto, "index.html"), "utf8"),
  readFile(join(proyecto, "public", "master-express.png")),
]);
const estilos = await postcss([tailwindcss({ config: join(proyecto, "tailwind.config.js") })])
  .process(css.replace(/^@import .*;\r?\n/, ""), { from: archivoCss });

const clienteLocal = `
  import { createLocalEntities } from "@/api/localEntities";
  const entidades = createLocalEntities();
  const fecha = new Date().toISOString().slice(0, 10);
  const eliminacion = new Date(Date.now() - 12 * 86400000).toISOString();
  const datos = {
    Administrador: [{ id: "admin-qa", username: "qa-admin", password: "solo-qa",
      nombre_completo: "Laura Moreno", rol: "presidente" }],
    Colaborador: [
      { id: "col-qa", username: "qa-colaborador", password: "solo-qa", nombre_completo: "Camila Ruiz", activo: true },
      { id: "col-vacio", nombre_completo: "Daniel Ortiz", activo: true },
    ],
    Evento: [{ id: "evento-qa", nombre_institucion: "Institución de prueba", tipo_institucion: "universidad",
      fecha, activo: true }],
    Ceremonia: [{ id: "ceremonia-qa", evento_id: "evento-qa", nombre: "Ceremonia de prueba", orden: 1 }],
    Graduando: [
      { id: "g1", nombre_completo: "Mariana Silva", colaborador_id: "col-qa", evento_id: "evento-qa",
        ceremonia_id: "ceremonia-qa", estado_pago: "completo", valor_total: 100000, abono: 100000,
        saldo: 0, fecha, paquete: "digital", medio_pago: "transferencia", telefono: "3000000000",
        programa_academico: "Ingeniería de sistemas", eliminado: false },
      { id: "g2", nombre_completo: "Mateo Pardo", colaborador_id: "col-qa", estado_pago: "pendiente",
        valor_total: 55000, abono: 20000, saldo: 35000, fecha, paquete: "fisico", medio_pago: "efectivo", eliminado: false },
      { id: "g3", nombre_completo: "Andrea Rojas", colaborador_id: "otro", estado_pago: "pendiente",
        valor_total: 70000, abono: 0, saldo: 70000, fecha, paquete: "digital", eliminado: false },
      { id: "papelera-qa", nombre_completo: "Histórico de papelera", eliminado: true, fecha_eliminacion: eliminacion },
    ],
    Gasto: [{ id: "gasto-qa", valor: 35000, fecha, concepto: "Insumos de prueba" }],
  };
  if (!sessionStorage.getItem("fixtures-ui")) {
    for (const [entidad, filas] of Object.entries(datos)) {
      localStorage.setItem("master-express:local:" + entidad, JSON.stringify(filas));
    }
    sessionStorage.setItem("fixtures-ui", "true");
  }
  const listar = entidades.Graduando.list;
  const filtrar = entidades.Graduando.filter;
  const falla = (rol) => {
    if (sessionStorage.getItem("fallo-ui") !== rol) return false;
    sessionStorage.removeItem("fallo-ui");
    return true;
  };
  entidades.Graduando.list = (...args) => falla("admin")
    ? Promise.reject(new Error("Fallo ficticio de indicadores")) : listar(...args);
  entidades.Graduando.filter = (...args) => falla("colaborador")
    ? Promise.reject(new Error("Fallo ficticio de registros")) : filtrar(...args);
  export const base44 = { entities: entidades };
`;

const { outputFiles: [bundle] } = await build({
  absWorkingDir: proyecto, entryPoints: ["src/main.jsx"], bundle: true, write: false, jsx: "automatic",
  loader: { ".css": "empty" },
  define: { "import.meta.env": "{}", "import.meta.hot": "undefined", "process.env.NODE_ENV": '"production"' },
  plugins: [{
    name: "aislamiento-base44",
    setup(contexto) {
      contexto.onResolve({ filter: /base44Client$|AuthContext$/ }, ({ path }) => ({
        path, namespace: "prueba",
      }));
      contexto.onLoad({ filter: /base44Client$/, namespace: "prueba" }, () => ({
        resolveDir: proyecto, contents: clienteLocal,
      }));
      contexto.onLoad({ filter: /AuthContext$/, namespace: "prueba" }, () => ({
        contents: "export const AuthProvider = ({ children }) => children; export const useAuth = () => ({});",
      }));
      contexto.onResolve({ filter: /^@\// }, ({ path }) =>
        contexto.resolve("./src/" + path.slice(2), { resolveDir: proyecto, kind: "import-statement" }));
    },
  }],
});

const pagina = html.replace('<script type="module" src="/src/main.jsx"></script>', '<script defer src="/prueba.js"></script>')
  .replace('<link rel="manifest" href="/manifest.json" />', '<link rel="stylesheet" href="/prueba.css" />');
const recursos = {
  "/prueba.js": ["text/javascript", bundle.contents],
  "/prueba.css": ["text/css", estilos.css],
  "/master-express.png": ["image/png", logo],
};
const servidor = createServer((peticion, respuesta) => {
  const recurso = recursos[peticion.url];
  const [tipo, contenido] = recurso || ["text/html; charset=utf-8", pagina];
  respuesta.setHeader("Content-Type", tipo);
  respuesta.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  respuesta.end(contenido);
});
const perfil = await mkdtemp(join(tmpdir(), "me-interfaz-"));
const errores = [];
let proceso, conexion;

async function hasta(comprobar, detalle) {
  for (let intento = 0; intento < 80; intento++) {
    const resultado = await comprobar();
    if (resultado) return resultado;
    await esperarMs(80);
  }
  throw new Error(detalle);
}

try {
  await new Promise((resolver, rechazar) => servidor.listen(0, "127.0.0.1", resolver).once("error", rechazar));
  const origen = `http://127.0.0.1:${servidor.address().port}`;
  proceso = spawn(navegador, [
    "--headless", "--disable-background-networking", "--no-first-run", "--remote-debugging-port=0",
    `--user-data-dir=${perfil}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  let falloProceso;
  proceso.once("error", error => { falloProceso = error; });
  const puerto = await hasta(async () => {
    if (falloProceso) throw falloProceso;
    const contenido = await readFile(join(perfil, "DevToolsActivePort"), "utf8").catch(() => "");
    return Number(contenido.split("\n")[0]);
  }, "Chrome no habilitó su puerto local de depuración.");
  const paginas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  conexion = new WebSocket(paginas.find(p => p.type === "page").webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    conexion.addEventListener("open", resolver, { once: true });
    conexion.addEventListener("error", rechazar, { once: true });
  });

  const pendientes = new Map();
  let id = 0;
  conexion.addEventListener("message", evento => {
    const mensaje = JSON.parse(evento.data);
    if (mensaje.method === "Runtime.exceptionThrown") {
      const detalle = mensaje.params.exceptionDetails;
      errores.push(detalle.exception?.description || detalle.text);
    }
    if (!pendientes.has(mensaje.id)) return;
    const { resolver, rechazar } = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    if (mensaje.error) rechazar(new Error(mensaje.error.message));
    else resolver(mensaje.result);
  });
  const enviar = (method, params = {}) => new Promise((resolver, rechazar) => {
    pendientes.set(++id, { resolver, rechazar });
    conexion.send(JSON.stringify({ id, method, params }));
  });
  const leer = async (funcion, ...args) => {
    const { result, exceptionDetails } = await enviar("Runtime.evaluate", {
      expression: `(${funcion})(...${JSON.stringify(args)})`, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  };
  const verificar = (resultado, detalle) => { assert(resultado, detalle); console.log(`PASS ${detalle}`); };
  const texto = (valor, selector = "body") => leer((v, s) => document.querySelector(s)?.textContent.includes(v), valor, selector);
  const clic = (selector) => leer(s => document.querySelector(s)?.click(), selector);
  const clicTexto = (valor, selector = "button") => leer((v, s) => {
    [...document.querySelectorAll(s)].find(e => e.textContent.trim().includes(v))?.click();
  }, valor, selector);
  const ir = (ruta) => enviar("Page.navigate", { url: origen + ruta });
  const ajustar = (width, height = 900) => enviar("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  const enfoque = (selector) => leer(s => document.querySelector(s)?.focus(), selector);
  const tecla = async (key, windowsVirtualKeyCode) => {
    const parametros = { key, code: key, nativeVirtualKeyCode: windowsVirtualKeyCode, windowsVirtualKeyCode };
    await enviar("Input.dispatchKeyEvent", key === "Enter"
      ? { ...parametros, type: "keyDown", text: "\r", unmodifiedText: "\r" }
      : { ...parametros, type: "rawKeyDown" });
    await enviar("Input.dispatchKeyEvent", { ...parametros, type: "keyUp" });
  };
  const pantalla = async (nombre) => {
    if (!capturas) return;
    await mkdir(capturas, { recursive: true });
    const { data } = await enviar("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(join(capturas, nombre + ".png"), Buffer.from(data, "base64"));
  };
  const ancho = (esperado) => leer(w => {
    const documento = document.documentElement;
    return window.innerWidth === w && documento.scrollWidth <= documento.clientWidth;
  }, esperado);
  const iniciar = async (rol, usuario) => {
    await hasta(() => texto("Soy " + rol), "No apareció la pantalla de ingreso.");
    await clicTexto("Soy " + rol);
    await hasta(() => texto("Ingrese sus credenciales"), "No apareció el formulario de ingreso.");
    await leer(u => {
      for (const [placeholder, valor] of [["Su nombre de usuario", u], ["Su contraseña", "solo-qa"]]) {
        const campo = document.querySelector(`[placeholder="${placeholder}"]`);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, valor);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, usuario);
    await clicTexto("Ingresar");
  };
  const indicadores = () => leer(() => Object.fromEntries([...document.querySelectorAll("main dl dt")]
    .map(etiqueta => [etiqueta.textContent, Number(etiqueta.nextElementSibling.textContent.replace(/\D/g, ""))])));
  const contraste = () => leer(() => {
    const luminancia = (color) => {
      const canales = color.match(/[\d.]+/g).slice(0, 3).map(valor => Number(valor) / 255)
        .map(valor => valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4);
      return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722;
    };
    const muestras = [
      ["aside", ".panel-navegacion__grupo"], ["aside [aria-current]", "aside [aria-current]"],
      [".panel-menu-movil", ".panel-menu-movil .panel-navegacion__destino:not([aria-current])"],
      [".panel-menu-movil", ".panel-menu-movil .panel-navegacion__grupo"],
      [".panel-indicador", ".panel-indicador dt"], [".panel-cabecera", ".panel-cabecera p"],
      [".panel-resultado", ".panel-resultado"], [".panel-accion", ".panel-accion"],
    ];
    return muestras.filter(([fondo, texto]) => document.querySelector(fondo) && document.querySelector(texto))
      .map(([fondo, texto]) => {
        const colorFondo = getComputedStyle(document.querySelector(fondo)).backgroundColor;
        const colorTexto = getComputedStyle(document.querySelector(texto)).color;
        const a = luminancia(colorFondo);
        const b = luminancia(colorTexto);
        return { texto, colorTexto, colorFondo, proporcion: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
  });
  const comprobarContraste = async (detalle) => {
    const muestras = await contraste();
    const fallos = muestras.filter(muestra => !(muestra.proporcion >= 4.5));
    assert.deepEqual(fallos, [], detalle);
    console.log(`PASS ${detalle}`);
  };

  await enviar("Runtime.enable");
  await enviar("Page.bringToFront");
  await enviar("Emulation.setEmulatedMedia", { features: [
    { name: "prefers-reduced-motion", value: "reduce" },
    { name: "prefers-color-scheme", value: "light" },
  ] });
  await ajustar(1440, 1050);
  await ir("/");
  await iniciar("Administrador", "qa-admin");
  await hasta(() => texto("Panel de administración", "main"), "No abrió el panel de administrador.");
  await hasta(() => leer(() => document.querySelector("aside img")?.naturalWidth > 0),
    "No se pudo cargar el logotipo local.");
  verificar(await leer(() => location.pathname === "/AdminDashboard" && document.title === "MasterExpress Control"
    && document.querySelector("aside img")?.naturalWidth > 0), "Ingreso de administrador, ruta y logotipo auténtico");
  assert.deepEqual(await indicadores(), {
    Graduandos: 3, Colaboradores: 2, Eventos: 1, "Pagos completos": 1, "Pagos pendientes": 2, Ingresos: 225000, Gastos: 35000,
  });
  verificar(await texto("190.000", "main"), "Indicadores y ganancia neta de administrador conservan los valores");
  verificar(await ancho(1440), "Administrador sin desbordamiento a 1440 px");
  await comprobarContraste("Muestras de texto del administrador en tema claro alcanzan 4.5:1");
  await pantalla("01-administrador-escritorio");
  for (const [acceso, destino] of [
    ["Gestionar colaboradores", "Colaboradores"], ["Gestionar eventos", "Eventos"],
    ["Gestionar gastos", "Gastos"], ["Ver registros de graduandos", "Registros de Graduandos"],
  ]) {
    await clicTexto(acceso, "main button");
    verificar(await hasta(() => texto(destino, 'aside [aria-current="page"]'), destino), `Acceso real a ${destino}`);
    await clicTexto("Panel Principal", "aside button");
  }
  await leer(() => {
    document.querySelector("main input[type=file]").click = () => { window.fotoQA = true; };
    document.querySelector('[aria-label="Cambiar foto de perfil"]').click();
  });
  verificar(await leer(() => window.fotoQA), "El botón de perfil conserva la acción de cambiar foto");
  await clic('[title="Modo oscuro"]');
  await hasta(() => leer(() => document.documentElement.classList.contains("dark")), "El tema oscuro no se activó.");
  await comprobarContraste("El control de tema funciona y las muestras en oscuro alcanzan 4.5:1");
  await clic('[title="Modo claro"]');

  await ajustar(390, 844);
  verificar(await ancho(390), "Administrador sin desbordamiento a 390 px");
  const disparador = '[aria-label="Abrir menú del panel"]';
  await enfoque(disparador);
  assert(await leer(s => document.activeElement.matches(s), disparador), "El disparador móvil no recibió el foco.");
  await tecla("Enter", 13);
  await hasta(() => leer(() => Boolean(document.querySelector('[role="dialog"]'))), "El menú móvil no abrió con Enter.");
  await hasta(() => leer(() => Boolean(document.activeElement.closest('[role="dialog"]'))), "No entró el foco al diálogo.");
  await tecla("Tab", 9);
  verificar(await leer(() => Boolean(document.activeElement.closest('[role="dialog"]'))),
    "Menú móvil abre con Enter y el foco permanece dentro al pulsar Tab");
  verificar(await leer(() => getComputedStyle(document.querySelector(".panel-menu-movil")).animationName === "none"),
    "El menú respeta la preferencia de movimiento reducido");
  await comprobarContraste("Los destinos y encabezados del menú móvil alcanzan 4.5:1");
  await pantalla("02-administrador-menu-movil");
  await tecla("Escape", 27);
  verificar(await hasta(() => leer(s => !document.querySelector('[role="dialog"]')
    && document.activeElement.matches(s), disparador), "Escape no devuelve el foco."),
  "Escape cierra el menú y devuelve el foco al disparador");
  await clic(disparador);
  await hasta(() => texto("Papelera", '[role="dialog"]'), "No apareció Papelera en el menú.");
  await clicTexto("Papelera", '[role="dialog"] nav button');
  await hasta(() => texto("Histórico de papelera", "main"), "No cargó el histórico de papelera.");
  verificar(await leer(() => !document.querySelector('[role="dialog"]')
    && [...document.querySelectorAll("main button")].find(b => b.textContent.trim() === "Eliminar")?.disabled),
  "Menú móvil abre Papelera y mantiene el borrado definitivo deshabilitado");
  verificar(await ancho(390), "Papelera sin desbordamiento a 390 px");

  await ajustar(768);
  await leer(() => sessionStorage.setItem("fallo-ui", "admin"));
  await ir("/AdminDashboard?estado=error");
  await hasta(() => texto("No se pudieron cargar los indicadores", '[role="alert"]'), "No apareció el error de indicadores.");
  await clicTexto("Volver a intentar", "main button");
  await hasta(() => texto("Panel de administración", "main"), "No se recuperaron los indicadores al reintentar.");
  verificar(await ancho(768), "Administrador recupera los indicadores y se adapta a 768 px");
  await clic('[aria-label="Cerrar sesión"]');
  await hasta(() => leer(() => location.pathname === "/" && !localStorage.getItem("admin_id")), "No cerró la sesión de administrador.");

  await ajustar(1440, 1000);
  await iniciar("Colaborador", "qa-colaborador");
  await hasta(() => texto("Mariana Silva", "main"), "No abrió el panel de colaborador.");
  verificar(await leer(() => location.pathname === "/ColaboradorDashboard"
    && document.querySelector('aside [aria-current="page"]')?.getAttribute("href") === "/ColaboradorDashboard"),
  "Ingreso de colaborador, ruta y estado activo");
  assert.deepEqual(await indicadores(), {
    "Mis graduandos": 2, "Pagos completos": 1, "Pagos pendientes": 1, "Total abonado": 120000,
  });
  verificar(!(await texto("Andrea Rojas", "main")), "Indicadores y registros del colaborador conservan su alcance");
  verificar(await ancho(1440), "Colaborador sin desbordamiento a 1440 px");
  await comprobarContraste("Muestras de texto del colaborador y su acción principal alcanzan 4.5:1");
  await pantalla("03-colaborador-escritorio");
  await ajustar(768);
  verificar(await ancho(768), "Colaborador sin desbordamiento a 768 px");
  await ajustar(390, 844);
  verificar(await ancho(390), "Colaborador sin desbordamiento a 390 px");
  await pantalla("04-colaborador-movil");
  await ajustar(320, 760);
  await clicTexto("Ver más", "main button");
  verificar(await ancho(320) && await texto("Ocultar", "main"), "El detalle abre sin desbordamiento a 320 px");
  await clic(disparador);
  await hasta(() => texto("Registrar graduando", '[role="dialog"]'), "No apareció el acceso a registro.");
  await clicTexto("Registrar graduando", '[role="dialog"] nav a');
  await hasta(() => texto("Registrar Nuevo Graduando", "main"), "No abrió el registro.");
  verificar(await leer(() => location.pathname === "/RegistroGraduando" && !document.querySelector('[role="dialog"]'))
    && await ancho(320), "Ruta de registro accesible desde el menú móvil y sin desbordamiento");
  await clicTexto("Volver al panel", "main a");
  await hasta(() => texto("Mariana Silva", "main"), "El registro no regresó al panel anterior.");
  await leer(() => sessionStorage.setItem("fallo-ui", "colaborador"));
  await ir("/ColaboradorDashboard?estado=error");
  await hasta(() => texto("No se pudieron cargar tus registros", '[role="alert"]'), "No se mostró el error de registros.");
  await clicTexto("Volver a intentar", "main button");
  verificar(await hasta(() => texto("Mariana Silva", "main"), "El reintento no recuperó los registros."),
    "Colaborador conserva sesión y recupera su lista tras un fallo de consulta");
  await leer(() => localStorage.setItem("colaborador_id", "col-vacio"));
  await ir("/ColaboradorDashboard?estado=vacio");
  verificar(await hasta(() => texto("Aún no tiene graduandos registrados", "main"), "No apareció el estado vacío."),
    "Colaborador sin registros muestra un estado vacío y conserva el acceso al registro");
  await clic('[aria-label="Cerrar sesión"]');
  verificar(await hasta(() => leer(() => location.pathname === "/" && !localStorage.getItem("colaborador_id")),
    "No cerró la sesión de colaborador."), "Los controles de cierre de sesión regresan al inicio");
  await ir("/Home");
  verificar(await hasta(() => texto("Soy Colaborador"), "La ruta /Home no abrió."), "La ruta /Home conserva el inicio existente");
  assert.deepEqual(errores, []);
  console.log("PASS Sin excepciones JavaScript sin manejar");
} catch (error) {
  if (errores.length) console.error(errores);
  throw error;
} finally {
  conexion?.close();
  if (proceso?.pid && proceso.exitCode === null && proceso.signalCode === null) {
    await new Promise(resolver => { proceso.once("exit", resolver); proceso.kill(); });
  }
  servidor.closeAllConnections();
  servidor.close();
  await rm(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
