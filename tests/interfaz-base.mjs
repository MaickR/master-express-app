// node tests/interfaz-base.mjs "ruta al ejecutable de Chrome o Edge" ["carpeta de capturas"]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
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
const web = join(proyecto, "apps", "web");
const archivoCss = join(web, "src", "app", "index.css");
const [css, html, logo] = await Promise.all([
  readFile(archivoCss, "utf8"),
  readFile(join(web, "index.html"), "utf8"),
  readFile(join(web, "public", "master-express.png")),
]);
const estilos = await postcss([tailwindcss({ config: join(web, "tailwind.config.js") })])
  .process(css.replace(/^@import .*;\r?\n/, ""), { from: archivoCss });

const clienteLocal = `
  import { createLocalEntities } from "@/integrations/base44/localEntities";
  const entidades = createLocalEntities();
  const fecha = new Date().toISOString().slice(0, 10);
  const eliminacion = new Date(Date.now() - 12 * 86400000).toISOString();
  const datos = {
    Colaborador: [
      { id: "col-qa", email: "qa-colaborador@example.invalid", nombre_completo: "Camila Ruiz", activo: true },
      { id: "col-vacio", email: "qa-vacio@example.invalid", nombre_completo: "Daniel Ortiz", activo: true },
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
  export const base44 = { entities: entidades }; export const useLocalEntities = true;
`;

const { outputFiles: [bundle] } = await build({
  absWorkingDir: proyecto, entryPoints: ["apps/web/src/app/main.tsx"], bundle: true, write: false, jsx: "automatic",
  loader: { ".css": "empty" },
  define: { "import.meta.env": "{}", "import.meta.hot": "undefined", "process.env.NODE_ENV": '"production"' },
  plugins: [{
    name: "aislamiento-base44",
    setup(contexto) {
      contexto.onResolve({ filter: /base44Client$/ }, ({ path }) => ({
        path, namespace: "prueba",
      }));
      contexto.onLoad({ filter: /base44Client$/, namespace: "prueba" }, () => ({
        resolveDir: proyecto, contents: clienteLocal,
      }));
      contexto.onResolve({ filter: /^@\// }, ({ path }) =>
        contexto.resolve("./apps/web/src/" + path.slice(2), { resolveDir: proyecto, kind: "import-statement" }));
    },
  }],
});

const pagina = html.replace('<script type="module" src="/src/app/main.tsx"></script>', '<script defer src="/prueba.js"></script>')
  .replace("</head>", '<link rel="stylesheet" href="/prueba.css" /></head>');
const inicioTema = pagina.match(/<script>([\s\S]*?)<\/script>/)[1];
const hashTema = createHash("sha256").update(inicioTema.replace(/\r\n/g, "\n")).digest("base64");
const recursos = {
  "/prueba.js": ["text/javascript", bundle.contents],
  "/prueba.css": ["text/css", estilos.css],
  "/master-express.png": ["image/png", logo],
};
const claveFicticia = randomBytes(16).toString("hex");
const cuentas = {
  "qa-admin@example.invalid": { id: 1, nombre: "Laura Moreno", roles: ["administrador"] },
  "qa-colaborador@example.invalid": { id: 2, nombre: "Camila Ruiz", roles: ["colaborador"] },
  "qa-vacio@example.invalid": { id: 3, nombre: "Daniel Ortiz", roles: ["colaborador"] },
};
const servidor = createServer(async (peticion, respuesta) => {
  const cookie = (peticion.headers.cookie || "").split("; ").find(valor => valor.startsWith("sesion-qa="));
  const correo = cookie?.slice("sesion-qa=".length);
  if (peticion.url === "/api/mi-sesion") {
    respuesta.setHeader("Content-Type", "application/json");
    if (!cuentas[correo]) return respuesta.writeHead(401).end("{}");
    return respuesta.end(JSON.stringify({ data: { ...cuentas[correo], correo } }));
  }
  if (peticion.url === "/sanctum/csrf-cookie") {
    return respuesta.writeHead(204, { "Set-Cookie": "XSRF-TOKEN=csrf-qa; Path=/" }).end();
  }
  if (["/login", "/logout"].includes(peticion.url)) {
    if (peticion.headers["x-xsrf-token"] !== "csrf-qa") return respuesta.writeHead(419).end();
    if (peticion.url === "/logout") {
      return respuesta.writeHead(204, { "Set-Cookie": "sesion-qa=; Max-Age=0; Path=/; HttpOnly" }).end();
    }
    let cuerpo = "";
    for await (const parte of peticion) cuerpo += parte;
    const { email, password } = JSON.parse(cuerpo);
    if (!cuentas[email] || password !== claveFicticia) return respuesta.writeHead(422).end();
    return respuesta.writeHead(204, { "Set-Cookie": "sesion-qa=" + email + "; Path=/; HttpOnly" }).end();
  }
  const recurso = recursos[peticion.url];
  const documento = peticion.url === "/?sin-react"
    ? pagina.replace('<script defer src="/prueba.js"></script>', '')
    : pagina;
  const [tipo, contenido] = recurso || ["text/html; charset=utf-8", documento];
  respuesta.setHeader("Content-Type", tipo);
  respuesta.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'self' 'sha256-${hashTema}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`);
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
  const emularSistema = (tema) => enviar("Emulation.setEmulatedMedia", { features: [
    { name: "prefers-reduced-motion", value: "reduce" },
    { name: "prefers-color-scheme", value: tema },
  ] });
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
  const aplicado = (tema) => leer(t => {
    const raiz = document.documentElement;
    return raiz.classList.contains("dark") === (t === "dark") && getComputedStyle(raiz).colorScheme === t;
  }, tema);
  const cambiarTema = async (nombre, tema) => {
    const activador = '[aria-label^="Tema visual:"]';
    await enfoque(activador);
    await tecla("Enter", 13);
    await hasta(() => texto(nombre, '[role="menu"]'), "El selector no abrió con Enter.");
    await comprobarContraste("El menú de tema en portal usa los colores del documento y alcanza 4.5:1");
    await clicTexto(nombre, '[role="menuitemradio"]');
    await hasta(() => aplicado(tema), `No se aplicó ${tema}.`);
    verificar(await leer((s, valor) => document.querySelector(s)?.getAttribute("aria-label") === `Tema visual: ${valor}`,
      activador, nombre), `El selector anuncia la preferencia ${nombre}`);
  };
  const ancho = (esperado) => leer(w => {
    const documento = document.documentElement;
    return window.innerWidth === w && documento.scrollWidth <= documento.clientWidth;
  }, esperado);
  const iniciar = async (correo) => {
    await hasta(() => texto("Iniciar sesión"), "No apareció el formulario de ingreso.");
    await leer(({ email, clave }) => {
      document.querySelector("#correo").value = email;
      document.querySelector("#contrasena").value = clave;
    }, { email: correo, clave: claveFicticia });
    await clic('form button[type="submit"]');
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
      [".acceso__panel", "label[for='correo']"],
      ["#correo", "#correo"], ["button[type='submit']", "button[type='submit']"],
      [".acceso__panel", "h1 + p"], ["#mensaje-acceso", "#mensaje-acceso"],
      [".acceso header", ".acceso header p"], [".acceso header", ".acceso header p + p"],
      [".acceso header", ".acceso header .text-primary"],
      ["[role='menu']", "[role='menuitemradio']"],
      ["[role='menuitemradio'][data-highlighted]", "[role='menuitemradio'][data-highlighted]"],
      ["[role='dialog']", "[role='dialog'] h2"],
      ["[role='listbox']", "[role='option']"],
      ["[role='listbox']", "[role='option'][data-highlighted]"],
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
  const comprobarDialogo = async (tema) => {
    await clicTexto("Administradores", "aside button");
    await hasta(() => texto("Nuevo Administrador", "main button"), "No cargó el formulario de administradores.");
    await clicTexto("Nuevo Administrador", "main button");
    await hasta(() => texto("Nuevo Administrador", '[role="dialog"]'), "No abrió el diálogo.");
    await enfoque('[role="dialog"] [role="combobox"]');
    await tecla("Enter", 13);
    await hasta(() => texto("Presidente", '[role="listbox"]'), "No abrió el Select del diálogo.");
    await comprobarContraste(`Los portales Dialog y Select mantienen el contraste del tema ${tema}`);
    await tecla("Escape", 27);
    await hasta(() => leer(() => !document.querySelector('[role="listbox"]')), "Escape no cerró el Select.");
    await clicTexto("Cancelar", '[role="dialog"] button');
    await hasta(() => leer(() => !document.querySelector('[role="dialog"]')), "Cancelar no cerró el diálogo.");
    await clicTexto("Panel Principal", "aside button");
  };
  const comprobarIngreso = async (tema) => {
    await comprobarContraste(`Contraste de las muestras de acceso en ${tema} ≥ 4.5:1`);
    for (const [width, height] of [[320, 568], [390, 660], [768, 1024], [1024, 768], [1440, 1050], [1920, 1080]]) {
      await ajustar(width, height);
      await hasta(() => ancho(width), `Ingreso desbordado a ${width} px.`);
      const composicion = await leer((modo) => {
        const marco = document.querySelector('.acceso__panel');
        const cabecera = marco.querySelector('header');
        const logo = cabecera.querySelector('img');
        const boton = marco.querySelector('button[type="submit"]');
        const luminanciaMedia = (elemento, propiedad) =>
          getComputedStyle(elemento)[propiedad].match(/[\d.]+/g).slice(0, 3)
            .reduce((suma, canal) => suma + Number(canal) / 3, 0);
        const superficies = [document.querySelector('.acceso'), marco, cabecera, marco.querySelector('#correo')];
        const rect = marco.getBoundingClientRect();
        return {
          alineado: Math.abs(rect.left + rect.width / 2 - innerWidth / 2) < 3,
          superficie: superficies.every(elemento => modo === 'claro'
            ? luminanciaMedia(elemento, 'backgroundColor') > 200
            : luminanciaMedia(elemento, 'backgroundColor') < 70),
          marca: logo.naturalWidth > 0 && new URL(logo.currentSrc).pathname === '/master-express.png',
          formulario: boton.getBoundingClientRect().bottom < innerHeight && boton.offsetHeight >= 44,
        };
      }, tema);
      assert.deepEqual(composicion, { alineado: true, superficie: true, marca: true, formulario: true });
      console.log(`PASS Ingreso ${tema} centrado, coherente y visible a ${width} × ${height}`);
      await pantalla(`login-${tema}-${width}`);
    }
  };

  await enviar("Runtime.enable");
  await enviar("Page.bringToFront");
  await emularSistema("light");
  await ajustar(1440, 1050);
  await ir("/");
  await hasta(() => texto("Iniciar sesión"), "No apareció el ingreso.");
  await hasta(() => leer(() => document.querySelector("header img")?.naturalWidth > 0), "No cargó la marca en el ingreso.");
  verificar(await aplicado("light"), "El ingreso inicia en claro con el sistema claro");
  await tecla("Tab", 9);
  verificar(await leer(() => document.activeElement?.matches('button[aria-label^="Tema visual:"]:focus-visible')
    && getComputedStyle(document.activeElement).outlineWidth === "2px"), "El primer Tab enfoca el selector con contorno visible");
  await comprobarIngreso("claro");
  await cambiarTema("Oscuro", "dark");
  await comprobarIngreso("oscuro");
  await ir("/?sin-react");
  await hasta(() => leer(() => location.search === "?sin-react" && document.readyState === "complete"),
    "La comprobación previa al render no cargó el documento.");
  verificar(await aplicado("dark") && await leer(() => !document.querySelector("#root").hasChildNodes()
    && getComputedStyle(document.body).backgroundColor === "rgb(18, 20, 23)"),
  "El fondo oscuro y color-scheme se aplican antes de React con sistema claro");
  await ir("/");
  await hasta(() => texto("Iniciar sesión"), "La recarga no mostró el ingreso.");
  verificar(await aplicado("dark"), "La preferencia oscura persiste al recargar");
  await cambiarTema("Sistema", "light");
  await emularSistema("dark");
  verificar(await hasta(() => aplicado("dark"), "El sistema no cambió a oscuro."),
    "Sistema cambia a oscuro sin recargar");
  await emularSistema("light");
  verificar(await hasta(() => aplicado("light"), "El sistema no volvió a claro."),
    "Sistema vuelve a claro sin recargar");
  await ir("/?recarga-sistema");
  await hasta(() => texto("Iniciar sesión"), "La recarga en Sistema no mostró el ingreso.");
  verificar(await leer(() => localStorage.getItem("theme") === "system"
    && Boolean(document.querySelector('[aria-label="Tema visual: Sistema"]'))), "Sistema persiste al recargar");
  await ajustar(1440, 1050);
  await iniciar("qa-admin@example.invalid");
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
  await pantalla("03-administrador-claro");
  await comprobarDialogo("claro");
  for (const [acceso, destino] of [
    ["Gestionar colaboradores", "Colaboradores"], ["Gestionar eventos", "Eventos"],
    ["Gestionar gastos", "Gastos"], ["Ver registros de graduandos", "Registros de Graduandos"],
  ]) {
    await clicTexto(acceso, "main button");
    verificar(await hasta(() => texto(destino, 'aside [aria-current="page"]'), destino), `Acceso real a ${destino}`);
    await clicTexto("Panel Principal", "aside button");
  }
  verificar(await leer(() => document.querySelector(".panel-avatar")?.textContent === "LM"
    && document.querySelector(".panel-cabecera").textContent.includes("Laura Moreno")
    && !document.querySelector('[aria-label="Cambiar foto de perfil"]')),
  "La cabecera muestra la identidad de sesión sin habilitar un perfil Base44 sin vínculo");
  await cambiarTema("Oscuro", "dark");
  verificar(await texto("Laura Moreno", ".panel-cabecera") && await texto("Panel de administración", "main"),
    "La sesión y la vista del administrador siguen activas al cambiar de tema");
  await comprobarContraste("El control de tema funciona y las muestras en oscuro alcanzan 4.5:1");
  await pantalla("04-administrador-oscuro");
  await comprobarDialogo("oscuro");
  await ajustar(320, 760);
  verificar(await ancho(320), "Administrador oscuro sin desbordamiento a 320 px");

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
  await pantalla("07-menu-movil-oscuro");
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
  await hasta(() => leer(() => location.pathname === "/" && Boolean(document.querySelector("#correo"))), "No cerró la sesión de administrador.");
  verificar(await aplicado("dark"), "Cerrar sesión conserva la preferencia visual");

  await ajustar(1440, 1000);
  await cambiarTema("Claro", "light");
  await iniciar("qa-colaborador@example.invalid");
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
  await pantalla("05-colaborador-claro");
  await cambiarTema("Oscuro", "dark");
  await comprobarContraste("Colaborador oscuro alcanza 4.5:1 en las muestras principales");
  verificar(await texto("Camila Ruiz", ".panel-cabecera") && await texto("Mariana Silva", "main"),
    "La sesión y los registros del colaborador se conservan al cambiar de tema");
  await pantalla("06-colaborador-oscuro");
  await ajustar(768);
  verificar(await ancho(768), "Colaborador sin desbordamiento a 768 px");
  await ajustar(390, 844);
  verificar(await ancho(390), "Colaborador sin desbordamiento a 390 px");
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
  await clic('[aria-label="Cerrar sesión"]');
  await iniciar("qa-vacio@example.invalid");
  await ir("/ColaboradorDashboard?estado=vacio");
  verificar(await hasta(() => texto("Aún no tiene graduandos registrados", "main"), "No apareció el estado vacío."),
    "Colaborador sin registros muestra un estado vacío y conserva el acceso al registro");
  await clic('[aria-label="Cerrar sesión"]');
  verificar(await hasta(() => leer(() => location.pathname === "/" && Boolean(document.querySelector("#correo"))),
    "No cerró la sesión de colaborador."), "Los controles de cierre de sesión regresan al inicio");
  await ir("/Home");
  verificar(await hasta(() => texto("Iniciar sesión"), "La ruta /Home no abrió."), "La ruta /Home conserva el inicio existente");
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
