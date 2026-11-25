import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const raiz = fileURLToPath(new URL('../', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const api = fileURLToPath(new URL('../apps/api/public/', import.meta.url));
const enrutador = '../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php';
const servicios = [
  { nombre: 'Laravel', puerto: 8000, ruta: '/api/salud', ejecutable: 'php',
    argumentos: ['-S', host + ':8000', enrutador], cwd: api, silencioso: true },
  { nombre: 'Vite', puerto: 5173, ruta: '/', ejecutable: process.execPath,
    argumentos: [vite, '--config', 'apps/web/vite.config.js', '--host', host, '--port', '5173', '--strictPort'],
    cwd: raiz, entorno: { VITE_BASE44_DATOS_LOCALES: 'true' } },
];

const control = new AbortController();
const procesos = [];
let fallo;

function detener(error) {
  if (control.signal.aborted) return;
  fallo = error;
  control.abort();
  for (const { proceso } of procesos) {
    if (proceso.pid && proceso.exitCode === null && proceso.signalCode === null) proceso.kill();
  }
}

function comprobarPuerto({ nombre, puerto }) {
  return new Promise((resolver, rechazar) => {
    const socket = createServer();
    socket.once('error', error => rechazar(new Error(
      error.code === 'EADDRINUSE'
        ? `${nombre} requiere el puerto ${host}:${puerto}, que está ocupado.`
        : `No se pudo comprobar el puerto ${host}:${puerto} (${error.code}).`,
    )));
    socket.listen({ host, port: puerto, exclusive: true }, () => socket.close(resolver));
  });
}

function iniciar({ nombre, ejecutable, argumentos, cwd, silencioso, entorno }) {
  // Con un solo worker de PHP, cada servidor es hijo directo y se puede cerrar por su PID.
  const env = { ...process.env, ...entorno };
  if (silencioso) delete env.PHP_CLI_SERVER_WORKERS;
  const proceso = spawn(ejecutable, argumentos, {
    cwd, env, windowsHide: true, stdio: silencioso ? 'ignore' : ['ignore', 'inherit', 'inherit'],
  });
  const cierre = new Promise(resolver => {
    proceso.once('error', error => detener(new Error(`No se pudo iniciar ${nombre} (${error.code}).`)));
    proceso.once('close', (codigo, senal) => {
      detener(new Error(`${nombre} se detuvo (${codigo ?? senal}).`));
      resolver();
    });
  });
  procesos.push({ proceso, cierre });
}

async function esperarServicio({ nombre, puerto, ruta }) {
  const limite = performance.now() + 45_000;
  while (performance.now() < limite) {
    control.signal.throwIfAborted();
    const respuesta = await fetch(`http://${host}:${puerto}${ruta}`, {
      signal: AbortSignal.any([control.signal, AbortSignal.timeout(1500)]),
    }).catch(() => undefined);
    if (respuesta) {
      await respuesta.body?.cancel();
      if (respuesta.ok) return;
    }
    await esperar(250, undefined, { signal: control.signal });
  }
  throw new Error(`${nombre} no respondió correctamente en ${host}:${puerto}.`);
}

for (const senal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(senal, () => detener());
}

try {
  await Promise.all(servicios.map(comprobarPuerto));
  control.signal.throwIfAborted();
  servicios.forEach(iniciar);
  await Promise.all(servicios.map(esperarServicio));
  console.log(`MasterExpress Control · http://${host}:5173/`);
  console.log(`Laravel · http://${host}:8000/api/salud`);
  console.log('Presiona Ctrl+C para detener ambos servidores.');
} catch (error) {
  detener(error);
}

await Promise.all(procesos.map(({ cierre }) => cierre));
if (fallo) {
  console.error(fallo.message);
  process.exitCode = 1;
}
