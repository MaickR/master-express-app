// Chrome real, sin dependencias adicionales. Credencial sintética únicamente por stdin.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

assert.equal(process.env.ME_QA_AUTOMATIZADO, 'true', 'El ensayo automatizado no se ejecuta sobre aceptación humana.');
assert.notEqual(process.env.ME_MYSQL_TEST_PORT, '3328');
let entrada = '';
for await (const parte of process.stdin) entrada += parte;
const { clave } = JSON.parse(entrada);
entrada = '';
const carpeta = process.argv[2];
await new Promise((resolve, reject) => {
  const hijo = spawn('php', ['../../tests/semilla-graduandos.php'], { cwd: 'apps/api', env: process.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let salida = ''; hijo.stdout.on('data', dato => { salida += dato; }); hijo.stderr.on('data', dato => { salida += dato; });
  hijo.on('error', reject); hijo.on('close', codigo => codigo === 0 ? resolve() : reject(new Error('Falló preparación de Chrome: ' + salida)));
  hijo.stdin.end(JSON.stringify({ clave }));
});
const capturas = join(carpeta, 'chrome');
const perfil = join(carpeta, 'perfil-chrome-' + randomBytes(4).toString('hex'));
await mkdir(capturas, { recursive: true });
const web = 'http://127.0.0.1:' + (process.env.ME_QA_WEB_PORT || '5189');
const api = 'http://127.0.0.1:' + (process.env.ME_QA_API_PORT || '8018');
const navegador = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-background-networking', '--no-first-run', '--remote-debugging-port=0',
  `--user-data-dir=${perfil}`, '--window-size=1440,1000', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let conexion;
let cerrarNavegador;
let cdpCapturaError;
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
  cdpCapturaError = () => cdp('Page.captureScreenshot', { format: 'png' });
  async function leer(fn, dato) {
    const resultado = await cdp('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(dato ?? null)})`, returnByValue: true, awaitPromise: true });
    if (resultado.exceptionDetails) throw new Error('Falló una comprobación del navegador.');
    return resultado.result.value;
  }
  const { targetInfos } = await cdp('Target.getTargets');
  sesion = (await cdp('Target.attachToTarget', { targetId: targetInfos.find(objeto => objeto.type === 'page').targetId, flatten: true })).sessionId;
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  const navegar = ruta => cdp('Page.navigate', { url: web + ruta });
  const texto = valor => leer(textoBuscado => (document.body?.textContent.includes(textoBuscado) ?? false), valor);
  async function clicSelector(selector) {
    await esperar(350);
    const punto = await leer(valor => {
      const elemento = document.querySelector(valor);
      elemento.scrollIntoView({ block: 'center' });
      const rect = elemento.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, selector);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...punto });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...punto });
  }
  async function clic(etiqueta) {
    if (etiqueta === 'Cerrar diálogo') await hasta(() => leer(() => document.querySelector('[role=dialog]')?.getAttribute('aria-busy') !== 'true'), 'La operación no terminó.');
    let selector;
    await hasta(async () => {
      selector = await leer(valor => {
        const elementos = [...document.querySelectorAll('button,a,[role="menuitem"],[role="menuitemradio"]')];
        const indice = elementos.findIndex(elemento => elemento.textContent.trim() === valor && elemento.getClientRects().length && (valor !== 'Registrar graduando' || elemento.tagName === 'BUTTON'));
        if (indice < 0) return null;
        elementos[indice].setAttribute('data-qa-control', 'seleccionado');
        return '[data-qa-control="seleccionado"]';
      }, etiqueta);
      return selector;
    }, 'No apareció control: ' + etiqueta);
    await clicSelector(selector);
    await leer(() => document.querySelector('[data-qa-control]')?.removeAttribute('data-qa-control'));
    if (etiqueta === 'Cerrar diálogo') await hasta(() => leer(() => !document.querySelector('[role=dialog]')), 'El diálogo no cerró.');
    if (etiqueta === 'Registrar graduando') await hasta(() => leer(() => !!document.querySelector('[role=dialog] input')), 'No abrió formulario.');
  }
  const campo = (selector, valor) => leer(([selectorCampo, valorCampo]) => {
    const elemento = document.querySelector(selectorCampo);
    const setter = Object.getOwnPropertyDescriptor(elemento.tagName === 'SELECT' ? HTMLSelectElement.prototype : elemento.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(elemento, valorCampo);
    elemento.dispatchEvent(new Event(elemento.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }, [selector, valor]);
  const enviar = selector => leer(valor => document.querySelector(valor).requestSubmit(), selector);

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
  async function ingresar(correo) {
    await navegar('/');
    await hasta(() => leer(() => Boolean(document.querySelector('#correo'))), 'No apareció ingreso.');
    await campo('#correo', correo); await campo('#contrasena', clave); await enviar('form');
    await hasta(() => leer(() => !document.querySelector('#correo') && Boolean(document.querySelector('main'))), 'No abrió sesión.');
  }
  async function salir() { await solicitud('/logout', {}); await navegar('/'); }
  async function campoEtiqueta(etiqueta, valor) {
    const selector = await leer(texto => {
      const etiqueta = [...document.querySelectorAll('[role="dialog"] label')].find(el => el.textContent.trim().startsWith(texto));
      const control = etiqueta?.querySelector('input,select');
      if (!control) throw new Error('Falta campo');
      control.setAttribute('data-qa-campo', 'actual'); return '[data-qa-campo="actual"]';
    }, etiqueta);
    await campo(selector, valor);
    await leer(() => document.querySelector('[data-qa-campo]')?.removeAttribute('data-qa-campo'));
  }
  const captura = async nombre => { const imagen = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(join(capturas, nombre + '.png'), Buffer.from(imagen.data, 'base64')); };
  const sufijo = randomBytes(3).toString('hex');
  const documentoChrome = '0000' + String(Math.floor(Math.random() * 90000000) + 10000000);
  const nombreInicial = 'Graduanda Chrome ' + sufijo;
  const nombreCorregido = 'Graduanda corregida ' + sufijo;
  const nombreExterno = 'Actualización otra sesión ' + sufijo;
  const nombreColab = 'Captura Colaborador ' + sufijo;
  await dimensiones(1440);
  await ingresar('qa.eventos@example.invalid');
  await clic('Registros de Graduandos');
  await hasta(() => texto('Graduandos e inscripciones'), 'Falta gestión.');
  await hasta(() => texto('Página 1'), 'Falta listado inicial.');
  await clic('Siguiente'); await hasta(() => texto('Página 2'), 'No paginó desde Laravel.');
  await clic('Anterior'); await hasta(() => texto('Página 1'), 'No regresó a la primera página.');
  await clic('Registrar graduando');
  await campoEtiqueta('Nombre completo', nombreInicial);
  await campoEtiqueta('Tipo de documento', 'CC');
  await campoEtiqueta('Número de documento', 'abc');
  assert.equal(await leer(() => document.querySelector('[role="dialog"] form').checkValidity()), false);
  await campoEtiqueta('Número de documento', documentoChrome);
  await campoEtiqueta('Correo', 'graduanda.chrome@example.invalid');
  await campoEtiqueta('Teléfono', '3000000000');
  await clicSelector('[role="dialog"] input[type="checkbox"]');
  await clic('Guardar perfil');
  await hasta(() => texto('El perfil quedó guardado.'), 'No guardó perfil.');
  const persona = (await solicitud('/api/graduandos?buscar=' + documentoChrome)).datos.data[0];
  assert.equal(persona.numero_documento, documentoChrome);
  await clic('Editar perfil');
  await campoEtiqueta('Nombre completo', nombreCorregido);
  await clicSelector('[role="dialog"] input[type="checkbox"]'); await clic('Guardar perfil');
  await hasta(() => texto(nombreCorregido), 'No guardó edición.');
  await clic('Ver detalle');
  await hasta(() => texto('Inscribir en ceremonia'), 'Falta inscripción.');
  await hasta(() => leer(() => document.querySelector('[role="dialog"] select')?.options.length > 1), 'Falta programación.');
  const evento = (await solicitud('/api/graduandos/programacion')).datos.data.find(fila => fila.nombre.includes('Colegio Ficticio Beta QA'));
  await campoEtiqueta('Evento disponible', evento.id); await campoEtiqueta('Ceremonia', evento.ceremonias[0].id);
  await campoEtiqueta('Programa académico', 'Programa Chrome QA');
  await clicSelector('[role="dialog"] input[type="checkbox"]'); await clic('Confirmar inscripción');
  await hasta(() => texto('La inscripción quedó confirmada.'), 'No confirmó inscripción.');
  await hasta(() => texto('Programa Chrome QA'), 'No actualizó inscripciones.');
  await clic('Cerrar diálogo');
  await navegar('/'); await hasta(() => texto('Panel de administración'), 'No recuperó sesión.'); await clic('Registros de Graduandos');
  await hasta(() => texto(nombreCorregido), 'No persistió tras recargar.');
  const resultados = [];
  async function tema(etiqueta, medio) {
    await cdp('Emulation.setEmulatedMedia', { features: [{name: 'prefers-color-scheme', value: medio}, {name: 'prefers-reduced-motion', value: 'reduce'}] });
    await leer(() => document.querySelector('[aria-label^="Tema visual:"]').focus());
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await hasta(() => leer(() => Boolean(document.querySelector('[role="menu"][aria-label="Tema visual"]'))), 'No abrió el menú de temas.');
    await clic(etiqueta);
    await hasta(() => leer(oscuro => document.documentElement.classList.contains('dark') === oscuro, etiqueta === 'Oscuro' || (etiqueta === 'Sistema' && medio === 'dark')), 'Tema sin aplicar.');
  }

  async function irPanel(nombre, ancho) {
    if (ancho < 1024) {
      await clicSelector('button[aria-label="Abrir menú del panel"]');
      await hasta(() => leer(() => Boolean(document.querySelector('.panel-menu-movil[data-state="open"]'))), 'No abrió la navegación móvil.');
      await esperar(550);
    }
    await clic(nombre);
  }

  async function medir(vista, modo, ancho) {
    const resultado = await leer(([vista, modo, ancho]) => {
      const intensidad = valor => valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
      const luma = rgb => rgb.slice(0, 3).map(v => intensidad(v / 255)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const color = valor => valor.match(/[\d.]+/g)?.map(Number) ?? [];
      const componer = (rgb, base) => base.map((canal, indice) => rgb[indice] * (rgb[3] ?? 1) + canal * (1 - (rgb[3] ?? 1)));
      function fondo(elemento) {
        if (!elemento) return [255, 255, 255];
        const rgb = color(getComputedStyle(elemento).backgroundColor);
        if (rgb.length === 3 || rgb[3] === 1) return rgb.slice(0, 3);
        return componer(rgb, fondo(elemento.parentElement));
      }
      const muestras = [...document.querySelectorAll('main h2,main .panel-indicador dt,main .panel-indicador dd,main [class*="bg-info-suave"],main .inline-flex.border,main [class*="text-exito"],main [class*="text-error"],main [class*="text-aviso"],main [class*="text-muted-foreground"],main button,[role="dialog"] h2,[role="dialog"] p,[role="dialog"] label,[role="dialog"] select,[role="dialog"] button')].filter(el => el.getClientRects().length && el.textContent.trim() && el.tagName !== 'svg' && !el.disabled && el.clientWidth > 0);
      const cocientes = muestras.map(el => {
        const fondoEfectivo = fondo(el);
        const texto = luma(componer(color(getComputedStyle(el).color), fondoEfectivo));
        const base = luma(fondoEfectivo);
        return { texto: el.textContent.trim().slice(0, 80), proporcion: (Math.max(texto, base) + 0.05) / (Math.min(texto, base) + 0.05) };
      });
      return { vista, modo, ancho, desplazamiento: Math.max(document.documentElement.scrollWidth - innerWidth, ...[...document.querySelectorAll('[role="dialog"]')].map(el => el.scrollWidth - el.clientWidth)), muestras: cocientes.length,
        menor: Number(Math.min(...cocientes.map(muestra => muestra.proporcion)).toFixed(2)), fallos: cocientes.filter(muestra => muestra.proporcion < 4.5) };
    }, [vista, modo, ancho]);
    resultados.push(resultado);
    if (resultado.desplazamiento > 0) {
      const diagnostico = await leer(() => [...document.querySelectorAll('[role="dialog"] *')].filter(el => el.scrollWidth > el.clientWidth && el.clientWidth).map(el => ({ etiqueta: el.tagName, clase: el.className, ancho: el.clientWidth, contenido: el.scrollWidth, texto: el.textContent.slice(0, 90) })));
      await writeFile(join(capturas, 'desbordamiento.json'), JSON.stringify({ resultado, diagnostico }, null, 2));
      assert.equal(resultado.desplazamiento, 0, 'Hay desbordamiento horizontal en el diálogo.');
    }

  }


  for (const [modo, medio] of [['Claro', 'light'], ['Oscuro', 'dark'], ['Sistema', 'light'], ['Sistema', 'dark']]) {
    await tema(modo, medio);
    for (const ancho of [320, 390, 425, 768, 1024, 1440]) {
      await dimensiones(ancho);
      await medir('listado', modo + '-' + medio, ancho);
      await clic('Ver detalle'); await hasta(() => texto('Inscripciones autorizadas'), 'Falta detalle.');
      await hasta(() => leer(() => document.querySelector('[role=dialog] select')?.options.length > 1), 'Falta carga de programación en detalle.');
      await medir('detalle', modo + '-' + medio, ancho); await clic('Cerrar diálogo');
      if (ancho === 390) {
        await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
        const punto = await leer(() => {
          const boton = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Registrar graduando');
          boton.scrollIntoView({ block: 'center' });
          const r = boton.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...punto, id: 1 }] });
        await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await hasta(() => leer(() => !!document.querySelector('[role=dialog] input')), 'No abrió con toque emulado.');
      } else await clic('Registrar graduando');
      await medir('formulario', modo + '-' + medio, ancho);
      if (ancho === 390 || ancho === 1440) await captura('formulario-' + modo + '-' + medio + '-' + ancho);
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await leer(() => document.activeElement.closest('[role="dialog"]') !== null), true);
      await leer(() => {
        const controles = [...document.querySelectorAll('[role="dialog"] input:not(:disabled),[role="dialog"] select:not(:disabled),[role="dialog"] button:not(:disabled)')];
        controles.at(-1).focus();
      });
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await leer(() => document.activeElement.closest('[role="dialog"]') !== null), true);

      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await hasta(() => leer(() => !document.querySelector('[role="dialog"]')), 'Escape no cerró.');
      await hasta(() => leer(() => document.activeElement.textContent.trim() === 'Registrar graduando'), 'No devolvió el foco al activador.');
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  }
  await writeFile(join(capturas, 'resultado-responsive.json'), JSON.stringify(resultados, null, 2));
  assert.equal(resultados.filter(item => item.desplazamiento > 0 || item.fallos.length).length, 0, 'Falló contraste o ajuste responsive.');
  await dimensiones(1440);
  const contar = () => leer(() => performance.getEntriesByType('resource').filter(item => new URL(item.name).pathname === '/api/graduandos').length);
  await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await hasta(() => texto('Sin conexión.'), 'Falta aviso offline.');
  assert.equal(await leer(() => [...document.querySelectorAll('button')].find(el => el.textContent === 'Registrar graduando').disabled), true);
  const antes = await contar();
  await cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await hasta(async () => await contar() > antes, 'Falta revalidación al reconectar.');
  const foco = await contar(); await leer(() => window.dispatchEvent(new Event('visibilitychange')));
  await hasta(async () => await contar() > foco, 'Falta revalidación al foco.');
  const sesionOriginal = sesion;
  const contextoSecundario = await cdp('Target.createBrowserContext');
  const objetivoSecundario = await cdp('Target.createTarget', { url: 'about:blank', browserContextId: contextoSecundario.browserContextId });
  sesion = (await cdp('Target.attachToTarget', { targetId: objetivoSecundario.targetId, flatten: true })).sessionId;
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await ingresar('qa.eventos@example.invalid');
  const segunda = await solicitud('/api/graduandos/' + persona.id, { nombre_completo: nombreExterno, tipo_documento: 'CC', numero_documento: documentoChrome, correo: 'graduanda.chrome@example.invalid', telefono: '3000000000', revision: 2 });
  assert.equal(segunda.estado, 200);
  sesion = sesionOriginal;
  await cdp('Target.disposeBrowserContext', { browserContextId: contextoSecundario.browserContextId });
  await leer(() => window.dispatchEvent(new Event('visibilitychange')));
  await hasta(() => texto(nombreExterno), 'No actualizó tras cambio externo.');
  await cdp('Network.setBlockedURLs', { urls: [api + '/api/graduandos?*'] });
  await leer(() => window.dispatchEvent(new Event('visibilitychange')));
  await hasta(() => texto('Volver a intentar'), 'Falta error recuperable.');
  await cdp('Network.setBlockedURLs', { urls: [] }); await clic('Volver a intentar');
  await hasta(() => texto(nombreExterno), 'No recuperó lista.');
  await clic('Vinculación de graduandos');
  await hasta(() => leer(() => !!document.querySelector('#buscar-graduando-operativo')), 'No abrió vinculación.');
  await campo('#buscar-graduando-operativo', nombreExterno);
  await hasta(() => texto(nombreExterno), 'No encontró graduando para vincular.'); await clic('Vincular cuenta');
  await hasta(() => texto('qa.graduando@example.invalid'), 'No cargó cuenta elegible.');
  await clicSelector('[role="dialog"] input[type="radio"]');
  await clic('Revisar y confirmar');
  await hasta(() => texto('Confirmar vinculación'), 'No abrió confirmación de vínculo.'); await clic('Confirmar vinculación');
  await hasta(() => texto('quedó activa. Cuenta'), 'No confirmó vínculo.');
  await hasta(() => leer(() => !document.querySelector('[role=dialog],[role=alertdialog]')), 'No cerró la confirmación del vínculo.');
  assert.equal((await solicitud('/api/graduandos?buscar=' + documentoChrome)).datos.data[0].vinculado, true);
  assert.equal(await leer(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  assert.deepEqual(await leer(async () => await caches.keys()), []);
  await salir(); await ingresar('qa.colaborador@example.invalid');
  await hasta(() => texto('Graduandos e inscripciones'), 'No abrió Colaborador.');
  assert.equal((await solicitud('/api/graduandos/' + persona.id)).estado, 404);
  await clic('Registrar graduando'); await campoEtiqueta('Nombre completo', nombreColab);
  await clicSelector('[role="dialog"] input[type="checkbox"]'); await clic('Guardar perfil');
  await hasta(() => texto(nombreColab), 'No registró Colaborador.');
  await clic('Ver detalle'); await hasta(() => texto('Inscribir en ceremonia'), 'No abrió inscripción Colaborador.');
  await hasta(() => leer(() => document.querySelector('[role="dialog"] select')?.options.length > 1), 'Falta programación Colaborador.');
  await campoEtiqueta('Evento disponible', evento.id); await campoEtiqueta('Ceremonia', evento.ceremonias[0].id);
  await clicSelector('[role="dialog"] input[type="checkbox"]'); await clic('Confirmar inscripción');
  await hasta(() => texto('La inscripción quedó confirmada.'), 'No inscribió Colaborador.');
  await clic('Cerrar diálogo'); await salir(); await ingresar('qa.institucion@example.invalid');
  await hasta(() => texto(nombreExterno), 'Institución no consultó ámbito propio.');
  assert.equal(await texto('Registrar graduando'), false);
  await campo('#gestion-buscar-graduando', nombreExterno);
  await hasta(async () => !await texto(nombreColab), 'La búsqueda institucional no filtró en servidor.');
  await clic('Ver detalle'); await hasta(() => texto('Programa Chrome QA'), 'Institución no ve su inscripción.');
  assert.equal(await texto('Inscribir en ceremonia'), false); await clic('Cerrar diálogo');
  await salir(); await ingresar('qa.graduando@example.invalid');
  await hasta(() => texto(nombreExterno), 'Graduando no ve vínculo activo.');
  assert.equal(await texto(nombreColab), false);
  assert.deepEqual(errores, []);
  const fallos = resultados.filter(item => item.desplazamiento > 0 || item.fallos.length);
  await writeFile(join(capturas, 'resultado.json'), JSON.stringify({ navegador: (await cdp('Browser.getVersion')).product, resultados, fallos }, null, 2));
  assert.equal(fallos.length, 0, 'Existen fallos de contraste o desbordamiento.');
  console.log('PASS Chrome: Administrador, Colaborador, Institución y Graduando; registro, edición, inscripción, vínculo, persistencia, permisos, conectividad y 72 muestras responsive/temas.');
  console.log('Evidencia: ' + capturas);
} catch (error) {
  const fallo = await cdpCapturaError?.().catch(() => {});
  if (fallo) await writeFile(join(capturas, 'fallo.png'), Buffer.from(fallo.data, 'base64'));
  console.log('Evidencia: ' + capturas);
  throw error;
} finally {
  await cerrarNavegador?.().catch(() => {});
  conexion?.close(); navegador.kill();
}
