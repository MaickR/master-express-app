// Observación HTTP del Chrome de aceptación. No inspecciona cuerpos de login ni contraseñas.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

export async function observarAceptacion(carpeta) {
  const perfil = join(carpeta, 'chrome-aceptacion-ernesto');
  await mkdir(join(perfil, 'Default'), { recursive: true });
  await writeFile(join(perfil, 'Default', 'Preferences'), JSON.stringify({
    credentials_enable_service: false, profile: { password_manager_enabled: false },
  }));
  const navegador = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`, '--window-size=1440,1000', 'http://127.0.0.1:5188/',
  ], { windowsHide: false, stdio: 'ignore' });
  navegador.unref();
  let puerto;
  for (let intento = 0; intento < 100; intento++) {
    puerto = Number((await readFile(join(perfil, 'DevToolsActivePort'), 'utf8').catch(() => '')).split(/\r?\n/)[0]);
    if (puerto) break;
    await esperar(200);
  }
  if (!puerto) throw new Error('Chrome no pudo iniciar la observación de aceptación.');
  const paginas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  const pagina = paginas.find(pagina => pagina.type === 'page' && pagina.url.startsWith('http://127.0.0.1:5188'));
  if (!pagina) throw new Error('No se encontró la página QA de aceptación.');
  const socket = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let numero = 0;
  const pendientes = new Map();
  const solicitudes = new Map();
  const respuestas = new Map();
  const eventos = [];
  const archivo = join(carpeta, 'aceptacion-ernesto-http.json');
  const guardar = () => writeFile(archivo, JSON.stringify({ eventos }, null, 2));
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++numero;
      pendientes.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  socket.addEventListener('message', async ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.id) {
      const pendiente = pendientes.get(mensaje.id);
      if (!pendiente) return;
      pendientes.delete(mensaje.id);
      if (mensaje.error) pendiente.reject(new Error('No se pudo leer una respuesta HTTP de aceptación.'));
      else pendiente.resolve(mensaje.result);
      return;
    }
    if (mensaje.method === 'Network.requestWillBeSent') {
      const { requestId, request } = mensaje.params;
      if (!request.url.startsWith('http://127.0.0.1:8008/')) return;
      // Guardar únicamente método/ruta. Se omiten headers, cookies y cuerpos.
      solicitudes.set(requestId, { metodo: request.method, ruta: new URL(request.url).pathname });
    }
    if (mensaje.method === 'Network.responseReceived') {
      const solicitud = solicitudes.get(mensaje.params.requestId);
      if (!solicitud) return;
      const evento = { ...solicitud, estado: mensaje.params.response.status };
      eventos.push(evento);
      respuestas.set(mensaje.params.requestId, evento);
      await guardar();
    }
    if (mensaje.method === 'Network.loadingFinished') {
      const evento = respuestas.get(mensaje.params.requestId);
      if (!evento || evento.estado !== 200 || !['/api/mi-sesion', '/api/mi-perfil', '/api/administracion/cuentas'].includes(evento.ruta)) return;
      try {
        const respuesta = await cdp('Network.getResponseBody', { requestId: mensaje.params.requestId });
        const datos = JSON.parse(respuesta.body).data;
        if (evento.ruta === '/api/mi-sesion') {
          evento.identidad = { id: datos.id, nombre: datos.nombre, correo: datos.correo, roles: datos.roles };
        } else if (evento.ruta === '/api/mi-perfil') {
          evento.perfil = { nombre: datos.nombre, correo: datos.correo, roles: datos.roles, activa: datos.activa, principal: datos.principal, correo_verificado: datos.correo_verificado };
        } else {
          evento.cuentas = datos.filter(cuenta => cuenta.correo === 'admin@masterexpress.app' || cuenta.correo.includes('aceptacion'))
            .map(cuenta => ({ id: cuenta.id, correo: cuenta.correo, roles: cuenta.roles, activa: cuenta.activa, principal: cuenta.principal }));
        }
        await guardar();
      } catch { /* La navegación puede descartar un body ya cerrado; no se registran sus valores. */ }
    }
  });
  await cdp('Network.enable');
  await cdp('Page.enable');
  await cdp('Page.bringToFront');
  await guardar();
  await writeFile(join(carpeta, 'chrome-aceptacion-listo'), 'PASS');
  for (let intento = 0; intento < 1800; intento++) {
    if ((await readFile(join(carpeta, 'aceptacion-ernesto-orden'), 'utf8').catch(() => '')).trim() === 'finalizar') break;
    await esperar(1000);
  }
  socket.close();
  console.log('PASS Observación HTTP finalizada; Chrome y servicios QA quedan disponibles.');
}
