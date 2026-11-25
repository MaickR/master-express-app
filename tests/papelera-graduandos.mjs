// Ejecutar con: node tests/papelera-graduandos.mjs "ruta al ejecutable de Chrome o Edge"
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function comprobarPapelera(React, createRoot, act, Papelera, graduandos) {
  const resultados = JSON.parse(sessionStorage.getItem("resultados") || "[]");
  const verificar = (condicion, nombre) => {
    resultados.push({ nombre, ok: Boolean(condicion) });
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const contenedor = document.getElementById("papelera");
  const raiz = createRoot(contenedor);
  const renderizar = () => act(async () => raiz.render(React.createElement(Papelera)));
  const botones = (texto) => [...contenedor.querySelectorAll("button")]
    .filter(boton => boton.textContent.trim() === texto);
  const sinBorrados = () => graduandos.borrados.length === 0;
  const consultasValidas = (cantidad) => graduandos.consultas.length === cantidad
    && graduandos.consultas.every(filtro => filtro.eliminado === true);

  try {
    await renderizar();
    if (resultados.length === 0) {
      verificar(consultasValidas(1) && sinBorrados(), "A. Abrir consulta sin borrar");
      verificar(contenedor.textContent.includes("Graduando histórico ficticio"), "C. Registro de diez días visible");
      sessionStorage.setItem("resultados", JSON.stringify(resultados));
      location.reload();
      return;
    }

    verificar(consultasValidas(1) && sinBorrados()
      && contenedor.textContent.includes("Graduando histórico ficticio"), "B. Recargar conserva el registro");

    const eliminar = botones("Eliminar");
    const controlesDeshabilitados = eliminar.length === 1 && eliminar.every(boton => boton.disabled);
    await act(async () => {
      for (const boton of eliminar) {
        boton.click();
        boton.disabled = false;
        boton.click();
      }
    });
    verificar(controlesDeshabilitados && sinBorrados() && botones("Confirmar").length === 0,
      "G. El botón deshabilitado carece de acción de borrado");

    await renderizar();
    await act(async () => graduandos.notificar({ type: "update", data: {
      id: "nuevo", eliminado: true, nombre_completo: "Ingreso ficticio a la papelera",
    } }));
    verificar(consultasValidas(1) && sinBorrados()
      && contenedor.textContent.includes("Ingreso ficticio a la papelera"), "F. Re-renderizados y actualización en tiempo real");

    await act(async () => botones("Restaurar")[0]?.click());
    verificar(JSON.stringify(graduandos.actualizaciones) === JSON.stringify([
      ["historico", { eliminado: false, fecha_eliminacion: null }],
    ]) && !contenedor.textContent.includes("Graduando histórico ficticio") && sinBorrados(),
    "D. Restaurar actualiza el estado y retira el registro de la vista");

    await act(async () => raiz.unmount());
    graduandos.fallarConsulta = true;
    const nuevaRaiz = createRoot(contenedor);
    await act(async () => nuevaRaiz.render(React.createElement(Papelera)));
    verificar(consultasValidas(2) && sinBorrados() && graduandos.actualizaciones.length === 1,
      "E. Consulta rechazada sin purga ni actualizaciones");
    await act(async () => nuevaRaiz.unmount());
  } catch (error) {
    verificar(false, error.stack);
  }
  await fetch("/resultado", { method: "POST", body: JSON.stringify(resultados) });
}

const clienteFicticio = `
  export const graduandos = {
    borrados: [],
    consultas: [],
    actualizaciones: [],
    async filter(filtro) {
      this.consultas.push(filtro);
      if (this.fallarConsulta) throw new Error("Fallo ficticio de consulta");
      return [{
        id: "historico", eliminado: true,
        fecha_eliminacion: new Date(Date.now() - 10 * 86400000).toISOString(),
        nombre_completo: "Graduando histórico ficticio",
      }];
    },
    subscribe(notificar) {
      this.notificar = notificar;
      return () => { this.notificar = undefined; };
    },
    async update(...datos) { this.actualizaciones.push(datos); },
    async delete(id) { this.borrados.push(id); },
  };
  export const base44 = { entities: { Graduando: graduandos } };
`;

const navegador = process.argv[2];
assert(navegador, "Indica la ruta al ejecutable de Chrome o Edge");
const proyecto = fileURLToPath(new URL("..", import.meta.url));
const { outputFiles: [bundle] } = await build({
  absWorkingDir: proyecto,
  stdin: {
    resolveDir: proyecto,
    contents: `
      import React, { act } from "react";
      import { createRoot } from "react-dom/client";
      import Papelera from "@/components/admin/PapeleraGraduandos";
      import { graduandos } from "@/api/base44Client";
      (${comprobarPapelera})(React, createRoot, act, Papelera, graduandos);
    `,
  },
  bundle: true,
  write: false,
  plugins: [{
    name: "cliente-base44-ficticio",
    setup(contexto) {
      contexto.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({
        path: "base44-ficticio", namespace: "prueba",
      }));
      contexto.onLoad({ filter: /.*/, namespace: "prueba" }, () => ({ contents: clienteFicticio }));
      contexto.onResolve({ filter: /^@\// }, ({ path }) =>
        contexto.resolve("./src/" + path.slice(2), { resolveDir: proyecto, kind: "import-statement" }));
    },
  }],
});

const perfil = await mkdtemp(join(tmpdir(), "me-papelera-"));
const servidor = createServer();
let proceso;
try {
  const resultado = new Promise((resolve, reject) => {
    servidor.on("request", async (peticion, respuesta) => {
      if (peticion.url === "/resultado" && peticion.method === "POST") {
        let cuerpo = "";
        for await (const parte of peticion) cuerpo += parte;
        respuesta.end();
        try {
          resolve(JSON.parse(cuerpo));
        } catch (error) {
          reject(error);
        }
      } else if (peticion.url === "/prueba.js") {
        respuesta.setHeader("Content-Type", "text/javascript");
        respuesta.end(bundle.contents);
      } else {
        respuesta.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'");
        respuesta.setHeader("Cache-Control", "no-store");
        respuesta.setHeader("Content-Type", "text/html; charset=utf-8");
        respuesta.end('<!doctype html><meta charset="utf-8"><div id="papelera"></div><script src="/prueba.js"></script>');
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
  assert.equal(comprobaciones.filter(({ ok }) => ok).length, 7);
  assert.equal(comprobaciones.length, 7);
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
