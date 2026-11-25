// Ejecutar con: node tests/vinculo-ceremonias.mjs "ruta al ejecutable de Chrome o Edge"
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function verificarCircuito({ React, act, createRoot, MemoryRouter, base44, Gestion, Registro, Todos, operaciones }) {
  const resultados = [];
  const verificar = (nombre, condicion) => {
    resultados.push({ nombre, ok: Boolean(condicion) });
    if (!condicion) throw new Error(nombre);
  };
  const diferir = () => {
    let resolver, rechazar;
    const promesa = new Promise((resolve, reject) => { resolver = resolve; rechazar = reject; });
    return { promesa, resolver, rechazar };
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { Evento, Ceremonia, Graduando } = base44.entities;
  const contenedor = document.getElementById("aplicacion");
  const raiz = createRoot(contenedor);
  const montar = (Pantalla) => act(async () => raiz.render(
    React.createElement(MemoryRouter, null, React.createElement(Pantalla))
  ));
  const boton = (texto) => [...document.querySelectorAll("button")]
    .find(elemento => elemento.textContent.trim().startsWith(texto));
  const selector = (indice) => contenedor.querySelectorAll('[role="combobox"]')[indice];
  const pulsar = (elemento) => act(async () => elemento.click());
  const abrir = (elemento) => act(async () => elemento.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
  ));
  const opciones = () => [...document.querySelectorAll('[role="option"]')];
  const elegirAbierta = (texto) => pulsar(opciones().find(opcion => opcion.textContent.startsWith(texto)));
  const elegir = async (elemento, texto) => { await abrir(elemento); await elegirAbierta(texto); };
  const digitar = (elemento, valor) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(elemento, valor);
    elemento.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const sinEfectos = () => operaciones.length === 0;
  const esperar = async (condicion) => {
    for (let intento = 0; intento < 50 && !condicion(); intento++) {
      await act(async () => new Promise(resolve => setTimeout(resolve, 20)));
    }
  };

  try {
    localStorage.setItem("colaborador_id", "colaborador-ficticio");
    const alterno = await Evento.create({ nombre_institucion: "Evento alterno", activo: true, fecha: "2099-03-01" });
    const fallido = await Evento.create({ nombre_institucion: "Evento con falla", activo: true, fecha: "2099-04-01" });
    await Evento.create({ nombre_institucion: "Evento inactivo", activo: false, fecha: "2099-05-01" });
    const ceremoniaAlterna = await Ceremonia.create({ evento_id: alterno.id, nombre: "Ceremonia alterna" });

    await montar(Gestion);
    await pulsar(boton("Crear Evento"));
    await digitar(document.getElementById("institucion"), "Institución ficticia");
    await digitar(document.getElementById("fecha"), "2099-02-01");
    const crear = document.querySelector('[role="dialog"] button.bg-primary');
    await act(async () => { crear.click(); crear.click(); });
    const activos = await Evento.filter({ activo: true });
    const nuevos = activos.filter(ev => ev.nombre_institucion === "Institución ficticia");
    verificar("A. Gestión crea una sola vez el evento activo", nuevos.length === 1
      && contenedor.textContent.includes("Institución ficticia"));
    const nuevo = nuevos[0];
    const [ceremoniaNueva] = await Ceremonia.filter({ evento_id: nuevo.id });
    await Graduando.create({ nombre_completo: "Histórico sin ceremonia", eliminado: false, evento_id: nuevo.id });
    await Graduando.create({
      nombre_completo: "Histórico de otro evento", eliminado: false,
      evento_id: alterno.id, ceremonia_id: ceremoniaAlterna.id,
    });

    const filtrarCeremonia = Ceremonia.filter;
    const consultas = new Map();
    Ceremonia.filter = (criterio) => consultas.get(criterio.evento_id)?.promesa ?? filtrarCeremonia(criterio);
    await montar(Registro);
    const evento = () => document.getElementById("registro-evento");
    const ceremonia = () => document.getElementById("registro-ceremonia");
    const guardar = () => boton("Registrar Graduando");
    await abrir(evento());
    verificar("A. El selector muestra el evento nuevo y excluye el inactivo",
      opciones().some(o => o.textContent.includes("Institución ficticia"))
      && !opciones().some(o => o.textContent.includes("Evento inactivo")));
    await elegirAbierta("Institución ficticia");
    await digitar(contenedor.querySelector('input[placeholder="Ej. Juan Pérez García"]'), "Venta ficticia");
    await pulsar(boton("Paquete Digital"));
    await pulsar(boton("Efectivo"));
    const archivos = new DataTransfer();
    archivos.items.add(new File(["imagen ficticia"], "pago.jpg", { type: "image/jpeg" }));
    const adjunto = contenedor.querySelector('input[type="file"]');
    adjunto.files = archivos.files;
    await act(async () => adjunto.dispatchEvent(new Event("change", { bubbles: true })));
    await esperar(() => contenedor.querySelector('img[alt="Comprobante 1"]'));
    await pulsar(guardar());
    verificar("F. Venta sin ceremonia queda bloqueada antes de subir un comprobante",
      Boolean(contenedor.querySelector('img[alt="Comprobante 1"]')) && guardar().disabled && sinEfectos());
    await elegir(ceremonia(), "Ceremonia 1");
    verificar("B. La ceremonia válida habilita guardar", !guardar().disabled);

    const lenta = diferir();
    const rapida = diferir();
    consultas.set(alterno.id, lenta);
    consultas.set(nuevo.id, rapida);
    await elegir(evento(), "Evento alterno");
    verificar("C. Cambiar de evento limpia y bloquea la ceremonia de inmediato",
      ceremonia().disabled && ceremonia().textContent.includes("Seleccionar ceremonia")
      && contenedor.textContent.includes("Cargando ceremonias") && guardar().disabled);
    await elegir(evento(), "Institución ficticia");
    await act(async () => rapida.resolver([ceremoniaNueva, ceremoniaAlterna]));
    await abrir(ceremonia());
    verificar("E. Las opciones excluyen una ceremonia ajena al evento",
      opciones().some(o => o.textContent.includes("Ceremonia 1"))
      && !opciones().some(o => o.textContent.includes("Ceremonia alterna")));
    await elegirAbierta("Ceremonia 1");
    await act(async () => lenta.resolver([ceremoniaAlterna]));
    verificar("D. Una respuesta anterior no borra ni reemplaza la selección actual",
      ceremonia().textContent.includes("Ceremonia 1") && !guardar().disabled);

    await Ceremonia.update(ceremoniaNueva.id, { evento_id: alterno.id });
    await pulsar(guardar());
    verificar("E. El envío vuelve a verificar pertenencia y rechaza el cambio sin efectos",
      contenedor.querySelector('[role="alert"]')?.textContent.includes("ya no está disponible") && sinEfectos());
    await Ceremonia.update(ceremoniaNueva.id, { evento_id: nuevo.id });
    const consultaFallida = diferir();
    consultas.set(fallido.id, consultaFallida);
    await elegir(evento(), "Evento con falla");
    await act(async () => consultaFallida.rechazar(new Error("Error ficticio de consulta")));
    await pulsar(guardar());
    verificar("G y L. La consulta rechazada informa el error y mantiene el envío bloqueado",
      contenedor.querySelector('[role="alert"]')?.textContent.includes("No se pudieron cargar las ceremonias")
      && guardar().disabled && ceremonia().disabled && sinEfectos());
    verificar("L. Los selectores tienen etiquetas asociadas y describen el estado de la consulta",
      evento().labels[0]?.textContent.includes("Evento de graduación")
      && ceremonia().labels[0]?.textContent.includes("Ceremonia")
      && document.getElementById(ceremonia().getAttribute("aria-describedby"))?.querySelector('[role="alert"]'));

    consultas.delete(nuevo.id);
    await elegir(evento(), "Institución ficticia");
    await elegir(ceremonia(), "Ceremonia 1");
    await Evento.update(nuevo.id, { activo: false });
    await pulsar(guardar());
    verificar("L. El envío rechaza un evento que dejó de estar activo",
      contenedor.querySelector('[role="alert"]')?.textContent.includes("ya no está disponible") && sinEfectos());
    await Evento.update(nuevo.id, { activo: true });

    const consultarEvento = Evento.get;
    Evento.get = async () => { throw new Error("Error ficticio de verificación"); };
    await pulsar(guardar());
    verificar("L. El fallo al verificar antes de guardar muestra un error y evita efectos",
      contenedor.querySelector('[role="alert"]')?.textContent.includes("No se pudo verificar") && sinEfectos());
    const validacion = diferir();
    let verificaciones = 0;
    Evento.get = () => { verificaciones++; return validacion.promesa; };
    const enviar = guardar();
    await act(async () => { enviar.click(); enviar.click(); });
    verificar("H. Doble envío inicia una sola validación y espera antes de producir efectos",
      verificaciones === 1 && boton("Guardando...")?.disabled && evento().disabled && ceremonia().disabled && sinEfectos());
    await act(async () => validacion.resolver(await consultarEvento(nuevo.id)));
    await esperar(() => operaciones.includes("correo"));
    Evento.get = consultarEvento;
    const ventas = await Graduando.filter({ nombre_completo: "Venta ficticia" });
    verificar("H. Una sola venta, un comprobante y un correo simulado con vínculo correcto",
      ventas.length === 1 && ventas[0].evento_id === nuevo.id && ventas[0].ceremonia_id === ceremoniaNueva.id
      && operaciones.join(",") === "comprobante,correo");

    await montar(Todos);
    verificar("I. La vista administrativa conserva el histórico sin ceremonia",
      contenedor.textContent.includes("Histórico sin ceremonia"));
    await elegir(selector(0), "Institución ficticia");
    verificar("J. El filtro de evento conserva registros con y sin ceremonia",
      contenedor.textContent.includes("Histórico sin ceremonia") && contenedor.textContent.includes("Venta ficticia")
      && !contenedor.textContent.includes("Histórico de otro evento"));
    await elegir(selector(1), "Ceremonia 1");
    verificar("J. El filtro de ceremonia muestra solo su venta vinculada",
      contenedor.textContent.includes("Venta ficticia") && !contenedor.textContent.includes("Histórico sin ceremonia"));
    await elegir(selector(0), "Evento alterno");
    verificar("J. Cambiar el filtro de evento restablece el filtro de ceremonia",
      selector(1).textContent.includes("Todas las ceremonias") && contenedor.textContent.includes("Histórico de otro evento")
      && !contenedor.textContent.includes("Venta ficticia"));
    const [historico] = await Graduando.filter({ nombre_completo: "Histórico sin ceremonia" });
    verificar("I. El histórico consultado sigue sin ceremonia asignada", !historico.ceremonia_id);
    await act(async () => raiz.unmount());
  } catch (error) {
    resultados.push({ nombre: error.stack, ok: false });
  }
  await fetch("/resultado", { method: "POST", body: JSON.stringify(resultados) });
}

const navegador = process.argv[2];
assert(navegador, "Indica la ruta al ejecutable de Chrome o Edge");
const proyecto = fileURLToPath(new URL("..", import.meta.url));
const { outputFiles: [bundle] } = await build({
  absWorkingDir: proyecto, bundle: true, write: false,
  define: { "import.meta.env": "{}" },
  stdin: {
    resolveDir: proyecto,
    contents: `
      import React, { act } from "react";
      import { createRoot } from "react-dom/client";
      import { MemoryRouter } from "react-router-dom";
      import Gestion from "@/features/ceremonias/GestionEventos";
      import Registro from "@/features/graduandos/RegistroGraduando";
      import Todos from "@/features/graduandos/TodosRegistros";
      import { base44, operaciones } from "@/integrations/base44/base44Client";
      (${verificarCircuito})({ React, act, createRoot, MemoryRouter, base44, Gestion, Registro, Todos, operaciones });
    `,
  },
  plugins: [{
    name: "aislamiento-base44",
    setup(contexto) {
      contexto.onResolve({ filter: /^@\/(integrations\/base44\/base44Client|integrations\/emailjs\/emailService)$/ }, ({ path }) => ({
        path, namespace: "prueba",
      }));
      contexto.onLoad({ filter: /base44Client$/, namespace: "prueba" }, () => ({
        resolveDir: proyecto,
        contents: `
          import { createLocalEntities } from "@/integrations/base44/localEntities";
          export const operaciones = [];
          export const base44 = {
            entities: createLocalEntities(),
            integrations: { Core: { async UploadFile() {
              operaciones.push("comprobante");
              return { file_url: "/comprobante-ficticio.jpg" };
            } } },
          };
        `,
      }));
      contexto.onLoad({ filter: /emailService$/, namespace: "prueba" }, () => ({
        resolveDir: proyecto,
        contents: `
          import { operaciones } from "@/integrations/base44/base44Client";
          export async function sendRegistroGraduandoEmail() { operaciones.push("correo"); }
        `,
      }));
      contexto.onResolve({ filter: /^@\// }, ({ path }) =>
        contexto.resolve("./apps/web/src/" + path.slice(2), { resolveDir: proyecto, kind: "import-statement" }));
    },
  }],
});

const perfil = await mkdtemp(join(tmpdir(), "me-vinculo-"));
const servidor = createServer();
let proceso;
try {
  const resultado = new Promise((resolve, reject) => {
    servidor.on("request", async (peticion, respuesta) => {
      if (peticion.url === "/resultado" && peticion.method === "POST") {
        let cuerpo = "";
        for await (const parte of peticion) cuerpo += parte;
        respuesta.end();
        try { resolve(JSON.parse(cuerpo)); } catch (error) { reject(error); }
      } else if (peticion.url === "/prueba.js") {
        respuesta.setHeader("Content-Type", "text/javascript");
        respuesta.end(bundle.contents);
      } else {
        respuesta.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self' data:; img-src data:; style-src 'unsafe-inline'");
        respuesta.setHeader("Content-Type", "text/html; charset=utf-8");
        respuesta.end('<!doctype html><meta charset="utf-8"><div id="aplicacion"></div><script src="/prueba.js"></script>');
      }
    });
  });
  await new Promise((resolve, reject) => servidor.listen(0, "127.0.0.1", resolve).once("error", reject));
  proceso = spawn(navegador, [
    "--headless", "--disable-background-networking", "--no-first-run",
    `--user-data-dir=${perfil}`, `http://127.0.0.1:${servidor.address().port}`,
  ], { stdio: "ignore", windowsHide: true });
  const fallo = new Promise((_, reject) => {
    proceso.once("error", reject);
    proceso.once("exit", codigo => reject(new Error(`El navegador se cerró antes de reportar (${codigo})`)));
  });
  const limite = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("El navegador no reportó resultados en 20 segundos")), 20000).unref();
  });
  const comprobaciones = await Promise.race([resultado, fallo, limite]);
  for (const { ok, nombre } of comprobaciones) console.log(`${ok ? "PASS" : "FAIL"} ${nombre}`);
  assert(comprobaciones.every(({ ok }) => ok));
  assert.equal(comprobaciones.length, 19);
} finally {
  if (proceso?.pid && proceso.exitCode === null && proceso.signalCode === null) {
    await new Promise(resolve => {
      proceso.once("exit", resolve);
      proceso.kill();
    });
  }
  servidor.closeAllConnections();
  servidor.close();
  await rm(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
