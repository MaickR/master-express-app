// Chrome real, sin dependencias adicionales. Credencial sintética únicamente por stdin.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

const ordenDesbloqueo = await readFile(join(process.argv[2], 'desbloqueo-ernesto-orden'), 'utf8').catch(() => '');
if (['diagnostico', 'preparar', 'aceptacion', 'persistir'].includes(ordenDesbloqueo.trim())) {
  process.stdin.resume();
  await (await import('./desbloqueo-ernesto-qa.mjs')).ejecutarDesbloqueo(process.argv[2], ordenDesbloqueo.trim());
  process.exit(0);
}

assert.equal(process.env.ME_QA_AUTOMATIZADO, 'true', 'El ensayo automatizado no se ejecuta sobre aceptación humana.');
assert.notEqual(process.env.ME_MYSQL_TEST_PORT, '3328');
let entrada = '';
for await (const parte of process.stdin) entrada += parte;
const { clave } = JSON.parse(entrada);
entrada = '';
const carpeta = process.argv[2];
const capturas = join(carpeta, 'chrome');
const perfil = join(carpeta, 'perfil-chrome-' + randomBytes(4).toString('hex'));
await mkdir(capturas, { recursive: true });
const web = 'http://127.0.0.1:' + (process.env.ME_QA_WEB_PORT || '5189');
const api = 'http://127.0.0.1:' + (process.env.ME_QA_API_PORT || '8018');
const correo = 'persona.qa.' + randomBytes(4).toString('hex') + '@hotmail.com';
const navegador = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-background-networking', '--no-first-run', '--remote-debugging-port=0',
  `--user-data-dir=${perfil}`, '--window-size=1440,1000', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let conexion;
let cerrarNavegador;
async function hasta(fn, mensaje) {
  for (let intento = 0; intento < 100; intento++) { if (await fn()) return; await esperar(200); }
  throw new Error(mensaje);
}
try {
  let depuracion;
  await hasta(async () => {
    const texto = await readFile(join(perfil, 'DevToolsActivePort'), 'utf8').catch(() => '');
    const [puerto, ruta] = texto.trim().split(/\r?\n/);
    if (Number(puerto) && ruta) depuracion = { puerto, ruta };
    return depuracion;
  }, 'Chrome no abrió depuración.');
  conexion = new WebSocket(`ws://127.0.0.1:${depuracion.puerto}${depuracion.ruta}`);
  await new Promise(resolve => conexion.addEventListener('open', resolve, { once: true }));
  let numero = 0, sesion;
  const pendientes = new Map();
  const errores = [];
  conexion.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.method === 'Runtime.exceptionThrown') errores.push(mensaje.params.exceptionDetails.text);
    if (mensaje.method === 'Page.javascriptDialogOpening') void cdp('Page.handleJavaScriptDialog', { accept: true });
    const llamada = pendientes.get(mensaje.id);
    if (!llamada) return;
    pendientes.delete(mensaje.id);
    clearTimeout(llamada.temporizador);
    if (mensaje.error) llamada.reject(new Error(`CDP ${llamada.metodo}`));
    else llamada.resolve(mensaje.result);
  });
  function cdp(metodo, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++numero;
      const temporizador = setTimeout(() => reject(new Error(`Tiempo agotado: ${metodo}`)), 18000);
      pendientes.set(id, { resolve, reject, temporizador, metodo });
      conexion.send(JSON.stringify({ id, method: metodo, params, sessionId: metodo.startsWith('Target.') || metodo.startsWith('Browser.') ? undefined : sesion }));
    });
  }
  cerrarNavegador = () => cdp('Browser.close');
  async function leer(fn, dato) {
    const resultado = await cdp('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(dato ?? null)})`, returnByValue: true, awaitPromise: true });
    if (resultado.exceptionDetails) throw new Error('Falló una comprobación del navegador.');
    return resultado.result.value;
  }
  const { targetInfos } = await cdp('Target.getTargets');
  sesion = (await cdp('Target.attachToTarget', { targetId: targetInfos.find(objeto => objeto.type === 'page').targetId, flatten: true })).sessionId;
  await cdp('Page.enable'); await cdp('Runtime.enable');
  const navegar = ruta => cdp('Page.navigate', { url: web + ruta });
  const texto = valor => leer(textoBuscado => (document.body?.textContent.includes(textoBuscado) ?? false), valor);
  async function clicSelector(selector) {
    const punto = await leer(valor => {
      const elemento = document.querySelector(valor);
      elemento.scrollIntoView({ block: 'center' });
      const rect = elemento.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, selector);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...punto });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...punto });
  }
  async function clic(etiqueta) {
    let selector;
    await hasta(async () => {
      selector = await leer(valor => {
        const elementos = [...document.querySelectorAll('button,a,[role="menuitem"]')];
        const indice = elementos.findIndex(elemento => elemento.textContent.trim() === valor && elemento.getClientRects().length);
        if (indice < 0) return null;
        elementos[indice].setAttribute('data-qa-control', 'seleccionado');
        return '[data-qa-control="seleccionado"]';
      }, etiqueta);
      return selector;
    }, 'No apareció control: ' + etiqueta);
    await clicSelector(selector);
    await leer(() => document.querySelector('[data-qa-control]')?.removeAttribute('data-qa-control'));
  }
  const campo = (selector, valor) => leer(([selectorCampo, valorCampo]) => {
    const elemento = document.querySelector(selectorCampo);
    const setter = Object.getOwnPropertyDescriptor(elemento.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(elemento, valorCampo);
    elemento.dispatchEvent(new Event(elemento.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }, [selector, valor]);
  const enviar = selector => leer(valor => document.querySelector(valor).requestSubmit(), selector);
  const captura = async nombre => {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(capturas, nombre + '.png'), Buffer.from(data, 'base64'));
  };
  const dimensiones = (width, height = 1000) => cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const solicitud = (ruta, cuerpo) => leer(async ([origen, rutaApi, datos]) => {
    const headers = { Accept: 'application/json' };
    if (datos) {
      const cookie = document.cookie.split('; ').find(valor => valor.startsWith('XSRF-TOKEN='));
      headers['Content-Type'] = 'application/json'; headers['X-XSRF-TOKEN'] = decodeURIComponent(cookie.slice(11));
    }
    const respuesta = await fetch(origen + rutaApi, { method: datos ? 'POST' : 'GET', credentials: 'include', headers, body: datos ? JSON.stringify(datos) : undefined });
    return { estado: respuesta.status, datos: await respuesta.json().catch(() => null) };
  }, [api, ruta, cuerpo]);
  async function ingresar(correo, password) {
    await navegar('/');
    await hasta(() => leer(() => Boolean(document.querySelector('#correo'))), 'No apareció ingreso.');
    await campo('#correo', correo); await campo('#contrasena', password); await enviar('form');
    await hasta(() => texto('Panel de administración'), 'No abrió Administración.');
  }
  await dimensiones(1440);
  await ingresar('administracion-automatizada@example.invalid', clave);
  const identidadInicial = (await solicitud('/api/mi-sesion')).datos.data;
  assert.equal(identidadInicial.roles[0], 'administrador');
  await clic('Cuentas internas');
  await clic('Crear cuenta interna');
  await campo('#crear-nombre', 'Persona de aceptación');
  await campo('#crear-correo', correo);
  await campo('#crear-rol', 'administrador');
  await enviar('[role="dialog"] form');
  await hasta(() => leer(() => Boolean(document.querySelector('[role="dialog"] output'))), 'No apareció entrega única.');
  const temporal = await leer(() => document.querySelector('[role="dialog"] output').textContent);
  assert(temporal.length >= 12, 'La entrega temporal no cumple el mínimo.');
  await clic('Listo');
  await campo('input[type="search"]', correo);
  await hasta(() => leer(valor => [...document.querySelectorAll('main li')].some(fila => fila.textContent.includes(valor)), correo), 'No apareció la cuenta filtrada.');
  await hasta(() => leer(() => !document.querySelector('main li')?.textContent.includes('Administrador automatizado')), 'La búsqueda no filtró.');
  const listado = await solicitud('/api/administracion/cuentas?q=' + encodeURIComponent(correo));
  assert.equal(listado.estado, 200);
  assert.equal(listado.datos.data.length, 1);
  assert.equal(listado.datos.data[0].cambio_clave_pendiente, true);
  const idCreada = listado.datos.data[0].id;
  assert.equal((await solicitud('/api/administracion/cuentas', { nombre: 'Persona duplicada', correo, rol: 'administrador' })).estado, 422);

  const contraste = [];
  for (const tema of ['light', 'dark']) {
    await leer(modo => document.documentElement.classList.toggle('dark', modo === 'dark'), tema);
    for (const ancho of [390, 425, 1440]) {
      await dimensiones(ancho);
      await esperar(100);
      const medidas = await leer(() => {
        const boton = document.querySelector('main [aria-label^="Acciones de "]');
        const estilo = getComputedStyle(boton);
        let fondo = estilo.backgroundColor;
        let padre = boton.parentElement;
        while (fondo === 'rgba(0, 0, 0, 0)' && padre) {
          fondo = getComputedStyle(padre).backgroundColor;
          padre = padre.parentElement;
        }
        const luminosidad = valor => valor.match(/[0-9.]+/g).slice(0, 3).map(Number).map(byte => {
          const canal = byte / 255;
          return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
        }).reduce((suma, canal, indice) => suma + canal * [0.2126, 0.7152, 0.0722][indice], 0);
        const niveles = [luminosidad(estilo.color), luminosidad(fondo)].sort((a, b) => a - b);
        return { sinDesborde: document.documentElement.scrollWidth <= innerWidth, alto: boton.getBoundingClientRect().height, ratio: (niveles[1] + 0.05) / (niveles[0] + 0.05) };
      });
      assert(medidas.sinDesborde && medidas.alto >= 44, 'La pantalla desborda o el objetivo táctil es pequeño.');
      assert(medidas.ratio >= 4.5, 'El contraste del botón de acciones no alcanza 4.5:1.');
      contraste.push({ tema, ancho, ...medidas });
      await captura('cuentas-' + tema + '-' + ancho);
    }
  }

  async function salir() {
    await clicSelector('[aria-label="Menú de cuenta"]');
    await clic('Cerrar sesión');
    await hasta(() => texto('Cerraste sesión'), 'No apareció el aviso de cierre.');
    assert.equal(await leer(() => [...document.querySelectorAll('[data-state="open"]')].filter(nodo => nodo.textContent.trim() === 'Cerraste sesión').length), 1);
  }

  await salir();
  await hasta(() => leer(() => Boolean(document.querySelector('#correo'))), 'El cierre no volvió al ingreso.');
  await leer(() => document.querySelector('button[aria-label="Cerrar notificación"]').focus());
  assert.equal(await leer(() => document.activeElement.getAttribute('aria-label')), 'Cerrar notificación');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await hasta(async () => !(await texto('Cerraste sesión')), 'Cerrar el aviso con teclado no funcionó.');
  await campo('#correo', correo);
  await campo('#contrasena', temporal);
  await enviar('form');
  await hasta(() => texto('Cambia tu contraseña temporal'), 'No se exigió el cambio inicial.');
  assert.equal((await solicitud('/api/administracion/cuentas')).estado, 403);
  assert.equal((await solicitud('/api/mi-sesion')).datos.data.id, idCreada);
  const definitiva = randomBytes(24).toString('hex');
  await campo('#current_password', temporal);
  await campo('#password', definitiva);
  await campo('#password_confirmation', definitiva);
  await enviar('main form');
  await hasta(() => leer(() => Boolean(document.querySelector('#correo'))), 'El cambio inicial no volvió al ingreso.');
  await ingresar(correo, definitiva);
  assert.equal((await solicitud('/api/mi-sesion')).datos.data.id, idCreada);
  assert.equal((await solicitud('/api/administracion/cuentas/' + identidadInicial.id, { accion: 'restablecer-clave' })).estado, 403);
  await salir();
  await hasta(() => leer(() => Boolean(document.querySelector('#correo'))), 'El cierre táctil no volvió al ingreso.');
  const botonCerrar = await leer(() => {
    const rect = document.querySelector('button[aria-label="Cerrar notificación"]').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [botonCerrar] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await hasta(async () => !(await texto('Cerraste sesión')), 'Cerrar el aviso mediante toque no funcionó.');
  await ingresar(correo, definitiva);
  await salir();
  await esperar(4800);
  assert.equal(await texto('Cerraste sesión'), false, 'El aviso quedó visible después del plazo.');
  await ingresar(correo, definitiva);
  assert.equal(await texto('Cerraste sesión'), false, 'El aviso reapareció al ingresar.');
  assert.deepEqual(errores, []);
  await writeFile(join(capturas, 'resultado.json'), JSON.stringify({
    estado: 'PASS', navegador: (await cdp('Browser.getVersion')).product, vistas: contraste,
    altaDirecta: true, duplicado422: true, cambioInicial: true, accesoPendiente403: true,
    principal403: true, notificacionManualTeclado: true, notificacionManualTactil: true, notificacionAutomatica: true, sinAvisoResidual: true,
  }, null, 2));
  console.log('PASS Chrome alta directa, búsqueda, cambio inicial, login definitivo, protección y avisos de cierre.');
  console.log('Evidencia: ' + capturas);

} finally {
  await cerrarNavegador?.().catch(() => {});
  conexion?.close(); navegador.kill();
}
