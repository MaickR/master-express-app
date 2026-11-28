import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const perfilAceptacion = process.env.LOCALAPPDATA && existsSync(join(process.env.LOCALAPPDATA, 'MasterExpress', 'aceptacion-local.dpapi'));
if (process.argv.includes('--aceptacion') || (perfilAceptacion && !process.argv.includes('--desarrollo'))) {
  const script = fileURLToPath(new URL('./aceptacion-local.ps1', import.meta.url));
  const args = ['-NoProfile', '-File', script];
  if (process.argv.includes('--reiniciar')) args.push('-ReiniciarWebApi');
  const hijo = spawn('powershell.exe', args, { windowsHide: true, stdio: 'inherit' });
  const codigo = await new Promise((resolve, reject) => { hijo.on('error', reject); hijo.on('close', resolve); });
  process.exit(codigo ?? 1);
}

const host = '127.0.0.1';
const urlWeb = `http://${host}:5173/`;
const abrirNavegador = process.platform === 'win32' && process.argv.includes('--abrir-navegador');
const raiz = fileURLToPath(new URL('../', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const api = fileURLToPath(new URL('../apps/api/public/', import.meta.url));
const enrutador = '../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php';
const servicios = [
  { nombre: 'Laravel', puerto: 8000, ruta: '/api/salud', ejecutable: 'php',
    comprobar: contenido => contenido.servicio === 'masterexpress-api' && contenido.estado === 'correcto',
    argumentos: ['-S', host + ':8000', enrutador], cwd: api, silencioso: true },
  { nombre: 'Vite', puerto: 5173, ruta: '/', ejecutable: process.execPath,
    comprobar: contenido => contenido.includes('<title>MasterExpress Control</title>'),
    argumentos: [vite, '--config', 'apps/web/vite.config.js', '--host', host, '--port', '5173', '--strictPort'],
    cwd: raiz, entorno: { VITE_BASE44_DATOS_LOCALES: 'true' } },
];

const control = new AbortController();
const procesos = [];
let instancia;
let entrada;
let fallo;

function detener(error) {
  if (control.signal.aborted) return;
  fallo = error;
  control.abort();
  entrada?.close();
  for (const { proceso } of procesos) {
    if (proceso.pid && proceso.exitCode === null && proceso.signalCode === null) proceso.kill();
  }
}

function reservarInstancia() {
  return new Promise((resolver, rechazar) => {
    const canal = createServer(socket => socket.destroy());
    canal.once('error', error => rechazar(new Error(error.code === 'EADDRINUSE'
      ? 'MasterExpress Control ya se está iniciando o está activo. Usa la consola que lo inició.'
      : `No se pudo reservar la instancia local (${error.code}).`)));
    // Windows libera la tubería con el proceso, incluso si se cierra la consola.
    canal.listen('\\\\.\\pipe\\masterexpress-control-dev-local', () => {
      instancia = canal;
      resolver();
    });
  });
}

function comprobarPuerto({ nombre, puerto }) {
  return new Promise((resolver, rechazar) => {
    const socket = createServer();
    socket.once('error', error => rechazar(new Error(
      error.code === 'EADDRINUSE'
        ? `${nombre} requiere el puerto ${host}:${puerto}, que está ocupado. Revisa el programa que lo usa.`
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

async function esperarServicio({ nombre, puerto, ruta, comprobar }) {
  const limite = performance.now() + 45_000;
  while (performance.now() < limite) {
    control.signal.throwIfAborted();
    const respuesta = await fetch(`http://${host}:${puerto}${ruta}`, {
      signal: AbortSignal.any([control.signal, AbortSignal.timeout(1500)]),
    }).catch(() => undefined);
    if (respuesta?.ok) {
      const contenido = await (ruta === '/' ? respuesta.text() : respuesta.json()).catch(() => undefined);
      if (contenido && comprobar(contenido)) return;
    } else {
      await respuesta?.body?.cancel();
    }
    await esperar(250, undefined, { signal: control.signal });
  }
  throw new Error(`${nombre} no respondió correctamente en ${host}:${puerto}.`);
}

for (const senal of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) {
  process.on(senal, () => detener());
}

try {
  if (process.platform === 'win32') await reservarInstancia();
  await Promise.all(servicios.map(comprobarPuerto));
  control.signal.throwIfAborted();
  servicios.forEach(iniciar);
  await Promise.all(servicios.map(esperarServicio));
  control.signal.throwIfAborted();
  console.log(`MasterExpress Control · ${urlWeb}`);
  console.log(`Laravel · http://${host}:8000/api/salud`);
  if (abrirNavegador) {
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', urlWeb], { windowsHide: true }, error => {
      if (error) console.error(`No se pudo abrir el navegador. Abre ${urlWeb} manualmente.`);
    });
    entrada = createInterface({ input: process.stdin });
    entrada.once('line', () => detener());
    console.log('Presiona Enter en esta ventana para detener ambos servidores.');
  } else {
    console.log('Presiona Ctrl+C para detener ambos servidores.');
  }
} catch (error) {
  detener(error);
}

await Promise.all(procesos.map(({ cierre }) => cierre));
instancia?.close();
if (fallo) {
  console.error(fallo.message);
  process.exitCode = 1;
}
