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
        const elementos = [...document.querySelectorAll('button,a,[role="menuitem"],[role="menuitemradio"]')];
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
    const setter = Object.getOwnPropertyDescriptor(elemento.tagName === 'SELECT' ? HTMLSelectElement.prototype : elemento.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
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
  await ingresar('qa.eventos@example.invalid', clave);
  assert.equal((await solicitud('/api/mi-sesion')).datos.data.roles[0], 'administrador');
  assert.equal(await texto('Datos de Base44'), false);
  await leer(() => {
    localStorage.setItem('master-express:local:Gasto', JSON.stringify([{ id: 'qa', tipo_gasto: 'Auditorio ficticio', fecha: '2099-02-25', valor: 540000, descripcion: 'Muestra visual QA' }]));
    localStorage.setItem('master-express:local:Graduando', JSON.stringify([{ id: 'qa', estado_pago: 'pendiente', valor_total: 850000, abono: 200000, saldo: 650000 }]));
  });
  await navegar('/');
  await hasta(() => texto('Panel de administración'), 'No abrió el panel después de sembrar la muestra visual.');
  await clic('Eventos');
  await hasta(() => texto('No hay eventos para esta consulta.'), 'Falta estado vacío.');
  const { datos: { data: instituciones } } = await solicitud('/api/instituciones');
  const colegio = instituciones.find(institucion => institucion.tipo === 'colegio');
  const universidad = instituciones.find(institucion => institucion.tipo === 'universidad');
  const fechas = (await solicitud('/api/eventos')).datos.fecha_operativa;
  const desplazar = dias => new Date(Date.parse(fechas) + dias * 86400000).toISOString().slice(0, 10);
  await clic('Crear evento');
  await campo('#institucion', colegio.id);
  await campo('#sede', colegio.sedes[0].id);
  await campo('#fecha', desplazar(-1));
  await enviar('[role="dialog"] form');
  await hasta(() => texto('Selecciona hoy o una fecha futura en Colombia.'), 'La validación de fecha pasada no apareció.');
  assert.equal(await leer(() => document.activeElement.id), 'fecha');
  await campo('#fecha', desplazar(3));
  await campo('#lugar', 'Auditorio de pruebas');
  await campo('#numCer', 2);
  await enviar('[role="dialog"] form');
  await hasta(() => texto('Auditorio de pruebas'), 'El evento creado no apareció en la lista.');
  await clic('Ver detalles · 2 ceremonias');
  await hasta(() => texto('Ceremonia 1'), 'No abrió detalle.');
  const listado = await solicitud('/api/eventos?vista=activa');
  const creado = listado.datos.data[0];
  assert.equal(creado.institucion.id, colegio.id);
  assert.equal(creado.fecha, desplazar(3));
  await clic('Editar evento');
  const detalle = await solicitud('/api/eventos/' + creado.id);
  const ceremonia = detalle.datos.data.ceremonias[0];
  await campo('#nombre-' + ceremonia.id, 'Ceremonia de Ingeniería');
  await campo('#hora-' + ceremonia.id, '09:15');
  await campo('#previstos', 120);
  await campo('#responsable', 'Coordinación QA');
  await campo('#observaciones', 'Ingreso por recepción.');
  await enviar('[role="dialog"] form');
  await hasta(() => texto('Ceremonia de Ingeniería'), 'La edición no se reflejó en el detalle.');
  const universidadCreada = await solicitud('/api/eventos', {
    institucion_id: universidad.id, sede_id: universidad.sedes[0].id, fecha: desplazar(5),
    lugar: 'Aula Magna QA', numero_ceremonias: 1, operation_id: randomUUID(),
  });
  assert.equal(universidadCreada.estado, 201);
  await navegar('/');
  await hasta(() => texto('Panel de administración'), 'No se recuperó la sesión al recargar.');
  await clic('Eventos');
  await hasta(() => texto('Aula Magna QA'), 'La vista no leyó el evento creado por API.');
  assert.equal(await texto('En 3 días'), true);
  await campo('#eventos-buscar', 'ingeniería');
  await campo('#eventos-institucion', colegio.id);
  await campo('#eventos-desde', fechas);
  await campo('#eventos-hasta', desplazar(4));
  await campo('#eventos-estado', 'proximo');
  await clic('Aplicar filtros');
  await hasta(async () => await texto('Auditorio de pruebas') && !await texto('Aula Magna QA'), 'La búsqueda combinada no devolvió el evento esperado.');
  await clic('Limpiar');
  await hasta(() => texto('Aula Magna QA'), 'No se limpiaron los filtros.');

  await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await hasta(() => texto('Sin conexión.'), 'Falta el estado sin conexión.');
  await clic('Crear evento');
  assert.equal(await leer(() => document.querySelector('[role="dialog"] button[type="submit"]').disabled), true);
  assert.equal(await texto('Recupera la conexión para guardar el evento.'), true);
  await clic('Cerrar');
  const contarConsultas = () => leer(() => performance.getEntriesByType('resource').filter(entrada => new URL(entrada.name).pathname === '/api/eventos').length);
  const consultasAntesDeConectar = await contarConsultas();
  assert(consultasAntesDeConectar > 0, 'Chrome no registró las consultas iniciales del listado.');
  await cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await hasta(async () => !await texto('Sin conexión.'), 'No se recuperó el estado de conexión.');
  await hasta(async () => await contarConsultas() > consultasAntesDeConectar, 'Falta la consulta al recuperar conexión.');
  const consultasAntesDeFoco = await contarConsultas();
  await leer(() => window.dispatchEvent(new Event('visibilitychange')));
  await hasta(async () => await contarConsultas() > consultasAntesDeFoco, 'Falta la consulta al recuperar foco.');
  assert.equal(await leer(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  assert.deepEqual(await leer(async () => (await caches.keys())), []);
  assert.deepEqual(await leer(async () => {
    const { fechaOperativa } = await import('/src/features/ceremonias/editor-evento.jsx');
    return ['2030-05-01T04:59:59Z', '2030-05-01T05:00:00Z'].map(fecha => fechaOperativa(new Date(fecha)));
  }), ['2030-04-30', '2030-05-01']);

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
      const muestras = [...document.querySelectorAll('main h2,main .panel-indicador dt,main .panel-indicador dd,main [class*="bg-info-suave"],main .inline-flex.border,main [class*="text-exito"],main [class*="text-error"],main [class*="text-aviso"],main [class*="text-muted-foreground"],main button')].filter(el => el.getClientRects().length && el.textContent.trim() && el.tagName !== 'svg' && !el.disabled && el.clientWidth > 0);
      const cocientes = muestras.map(el => {
        const fondoEfectivo = fondo(el);
        const texto = luma(componer(color(getComputedStyle(el).color), fondoEfectivo));
        const base = luma(fondoEfectivo);
        return { texto: el.textContent.trim().slice(0, 80), proporcion: (Math.max(texto, base) + 0.05) / (Math.min(texto, base) + 0.05) };
      });
      return { vista, modo, ancho, desplazamiento: document.documentElement.scrollWidth - innerWidth, muestras: cocientes.length,
        menor: Number(Math.min(...cocientes.map(muestra => muestra.proporcion)).toFixed(2)), fallos: cocientes.filter(muestra => muestra.proporcion < 4.5) };
    }, [vista, modo, ancho]);
    resultados.push(resultado);
  }

  for (const [modo, medio] of [['Claro', 'light'], ['Oscuro', 'dark'], ['Sistema', 'light'], ['Sistema', 'dark']]) {
    await dimensiones(1440);
    await tema(modo, medio);
    for (const [destino, espera] of [['Eventos', 'Aula Magna QA'], ['Panel Principal', 'Panel de administración'], ['Gastos', 'Auditorio ficticio'], ['Resumen Financiero', 'Pendiente por Cobrar']]) {
      await dimensiones(1440);
      await irPanel(destino, 1440);
      await hasta(() => texto(espera), 'No se mostró ' + destino);
      for (const ancho of [320, 390, 425, 768, 1024, 1440]) {
        await dimensiones(ancho);
        await medir(destino, modo + ' ' + medio, ancho);
      }
    }
  }
  const fallos = resultados.filter(resultado => resultado.fallos.length || resultado.desplazamiento > 0);
  await writeFile(join(capturas, 'contraste.json'), JSON.stringify(resultados, null, 2));
  if (fallos.length) console.log(JSON.stringify(fallos.filter(({ ancho, modo }) => ancho === 320 && !modo.startsWith('Sistema'))));

  await dimensiones(390);
  await irPanel('Eventos', 390);
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const punto = await leer(() => {
    const control = [...document.querySelectorAll('main button')].find(elemento => elemento.textContent.includes('Ver detalles') && elemento.textContent.includes('2 ceremonias'));
    control.scrollIntoView({block: 'center'});
    const rect = control.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, alto: rect.height };
  });
  assert(punto.alto >= 44);
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: punto.x, y: punto.y }] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await hasta(() => texto('Ceremonia de Ingeniería'), 'El toque emulado no mostró los datos editados.');
  await captura('eventos-390');
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await dimensiones(1440);
  await clic('Cancelar evento');
  assert.equal(await leer(() => document.activeElement.textContent.trim()), 'Volver');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await hasta(() => leer(() => !document.querySelector('[role="alertdialog"]')), 'Escape no cerró la confirmación.');
  assert.equal(await leer(() => document.activeElement.textContent.trim()), 'Cancelar evento');
  await clic('Cancelar evento');
  await clic('Confirmar cancelación');
  await hasta(async () => !await texto('Auditorio de pruebas'), 'La cancelación no retiró el evento de la programación activa.');
  await clic('Historial');
  await hasta(() => texto('Auditorio de pruebas'), 'El evento cancelado no apareció en historial.');
  await clic('Ver detalles · 2 ceremonias');
  await hasta(() => texto('Fecha de cancelación'), 'No se mostró el registro de cancelación.');
  assert.equal(await texto('Ceremonia de Ingeniería'), true);
  assert.equal(await texto('Modo de ensayo con Laravel'), false);
  await captura('historial-1440');

  await cdp('Network.setBlockedURLs', { urls: [api + '/api/eventos?*'] });
  await clic('Programación activa');
  await hasta(() => texto('Volver a intentar'), 'No apareció el error recuperable.');
  await cdp('Network.setBlockedURLs', { urls: [] });
  await clic('Volver a intentar');
  await hasta(() => texto('Aula Magna QA'), 'No se recuperó el listado después del error.');
  assert.equal((await solicitud('/api/eventos/' + creado.id)).datos.data.estado, 'cancelado');
  assert.deepEqual(errores, []);
  await writeFile(join(capturas, 'resultado.json'), JSON.stringify({ navegador: (await cdp('Browser.getVersion')).product, muestras: resultados.length, fallos: fallos.length }, null, 2));
  console.log('PASS Chrome: alta y edición MySQL, recarga, filtros, cancelación e historial, error y recuperación, teclado, toque emulado y conexión.');
  console.log('Evidencia: ' + capturas);
  assert.equal(fallos.length, 0, 'Existen muestras de contraste o desbordamiento pendientes.');
} catch (error) {
  const fallo = await cdpCapturaError?.().catch(() => {});
  if (fallo) await writeFile(join(capturas, 'fallo.png'), Buffer.from(fallo.data, 'base64'));
  console.log('Evidencia: ' + capturas);
  throw error;
} finally {
  await cerrarNavegador?.().catch(() => {});
  conexion?.close(); navegador.kill();
}
