// Requiere los servicios de QA temporal descritos en ME-REG1B.md.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as dormir } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const [ejecutable] = process.argv.slice(2);
assert(ejecutable, 'Indica la ruta de Chrome.');
const web = 'http://127.0.0.1:5173';
const apiNormal = 'http://127.0.0.1:8000';
const api = process.env.ME_REG1C_API || apiNormal;
assert.match(api, /^http:\/\/127\.0\.0\.1:\d+$/);
const bandeja = 'http://127.0.0.1:8026/mensajes';
const carpetaApi = fileURLToPath(new URL('../apps/api', import.meta.url));
const base = '/api/registro-graduando/';
const sufijo = randomBytes(5).toString('hex');
const correoInicial = 'primero-' + sufijo + '@example.invalid';
const correoFinal = 'graduando-' + sufijo + '@example.invalid';
const claveInicial = randomBytes(15).toString('hex');
const claveNueva = randomBytes(15).toString('hex');
const nombreLargo = 'María' + 'ñ'.repeat(130);

function baseQa(accion, email = correoFinal) {
  const php = String.raw`
    require 'vendor/autoload.php';
    $app = require 'bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $db = $app['db']->connection();
    $servidor = $db->selectOne('SELECT DATABASE() nombre, @@port puerto, @@datadir ruta');
    $temporal = getenv('ME_REGISTRO_MYSQL_TEMPORAL');
    if (!$app->environment('testing') || $db->getName() !== 'mysql_pruebas'
        || $servidor->nombre !== 'masterexpress_control_test' || (int) $servidor->puerto === 3306
        || !$temporal || !realpath($temporal) || realpath($temporal) !== realpath($servidor->ruta)) {
        exit(2);
    }
    [$accion, $email] = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    if (!preg_match('/\A(?:primero|graduando)-[0-9a-f]{10}@example\.invalid\z/', $email)) {
        exit(3);
    }
    if ($accion === 'conteos') {
        $metricas = [];
        foreach (['graduandos', 'registros', 'eventos', 'ceremonias', 'instituciones', 'ventas', 'pagos'] as $tabla) {
            $metricas[$tabla] = $db->getSchemaBuilder()->hasTable($tabla) ? $db->table($tabla)->count() : null;
        }
        echo json_encode($metricas, JSON_THROW_ON_ERROR);
    } elseif ($accion === 'cuenta') {
        $usuarios = App\Models\User::query()->where('email', $email)->get();
        echo json_encode([
            'cantidad' => $usuarios->count(),
            'roles' => $usuarios->first()?->roles()->pluck('codigo')->all(),
            'verificado' => $usuarios->first()?->email_verified_at !== null,
        ], JSON_THROW_ON_ERROR);
    } elseif ($accion === 'vencer-sesion') {
        $id = App\Models\User::query()->where('email', $email)->sole()->id;
        echo json_encode($db->table('sessions')->where('user_id', $id)
            ->update(['last_activity' => now()->subDays(2)->timestamp]) > 0);
    } else {
        $huella = hash_hmac('sha256', "registro-graduando\0correo\0".$email, $app['encrypter']->getKey());
        $fila = $db->table('desafios_de_registro')->where('clave', $huella);
        $cambios = match ($accion) {
            'vencer' => $fila->update(['vence_en' => now()->timestamp - 1]),
            'habilitar-reenvio' => $fila->update(['reenviar_desde' => now()->timestamp - 1]),
            default => 0,
        };
        if ($cambios !== 1) exit(4);
        echo 'true';
    }
  `;
  const salida = spawnSync('php', ['-r', php], {
    cwd: carpetaApi, input: JSON.stringify([accion, email]), encoding: 'utf8', windowsHide: true, timeout: 12000,
  });
  assert.equal(salida.status, 0, 'No se pudo verificar la base temporal de QA.');
  return JSON.parse(salida.stdout);
}

async function hasta(consultar, descripcion) {
  for (let intento = 0; intento < 100; intento++) {
    const resultado = await consultar();
    if (resultado) return resultado;
    await dormir(100);
  }
  throw new Error(descripcion);
}

async function mensaje(destinatario, propiedad, distinto = '') {
  return hasta(async () => {
    const respuesta = await fetch(bandeja, { headers: { Accept: 'application/json' } });
    assert.equal(respuesta.status, 200);
    const mensajes = await respuesta.json();
    return mensajes.find(item => item.destinatario === destinatario && item[propiedad] && item[propiedad] !== distinto)?.[propiedad];
  }, 'La bandeja no recibió el mensaje esperado.');
}

const perfil = await mkdtemp(join(tmpdir(), 'me-reg1b-chrome-'));
const chrome = spawn(ejecutable, [
  '--headless', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--user-data-dir=' + perfil, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let conexion;
let fase = 'inicio de Chrome';
const respuestas = new Map();
try {
  const puerto = await hasta(async () => {
    const datos = await readFile(join(perfil, 'DevToolsActivePort'), 'utf8').catch(() => '');
    return Number(datos.split(/\r?\n/)[0]);
  }, 'Chrome no abrió DevTools.');
  const [{ webSocketDebuggerUrl }] = (await (await fetch('http://127.0.0.1:' + puerto + '/json/list')).json()).filter(pagina => pagina.type === 'page');
  conexion = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    conexion.addEventListener('open', resolver, { once: true });
    conexion.addEventListener('error', rechazar, { once: true });
  });

  let secuencia = 0, simular = null, envios = 0, solicitudesCodigo = 0;
  const pendientes = new Map();
  const solicitudes = new Map();
  const erroresConsola = [];
  const cdp = (method, params = {}) => new Promise((resolver, rechazar) => {
    const id = ++secuencia;
    const limite = setTimeout(() => {
      pendientes.delete(id);
      rechazar(new Error('Tiempo agotado en ' + method));
    }, 15000);
    pendientes.set(id, { resolver, rechazar, limite, method });
    conexion.send(JSON.stringify({ id, method, params }));
  });
  conexion.addEventListener('message', ({ data }) => {
    const { id, method, params, result, error } = JSON.parse(data);
    if (method === 'Runtime.exceptionThrown') erroresConsola.push(true);
    if (method === 'Network.requestWillBeSent' && params.request.url.startsWith(api)) {
      const ruta = new URL(params.request.url).pathname;
      if (ruta === base + 'cuenta' && params.request.method === 'POST') envios++;
      if (ruta === base + 'codigo' && params.request.method === 'POST') solicitudesCodigo++;
      if (params.request.method !== 'OPTIONS') solicitudes.set(params.requestId, ruta);
    }
    if (method === 'Network.responseReceived' && solicitudes.has(params.requestId)) {
      const ruta = solicitudes.get(params.requestId);
      respuestas.set(ruta, params.response.status);
      solicitudes.delete(params.requestId);
    }
    if (method === 'Fetch.requestPaused') {
      const { requestId, request } = params;
      const estado = request.method === 'POST' ? simular : null;
      if (estado) simular = null;
      if (estado) {
        void cdp('Fetch.fulfillRequest', {
          requestId, responseCode: estado,
          responsePhrase: estado === 419 ? 'Page Expired' : 'Service Unavailable',
          responseHeaders: [
            { name: 'Access-Control-Allow-Origin', value: web },
            { name: 'Access-Control-Allow-Credentials', value: 'true' },
            { name: 'Content-Type', value: 'application/json' },
          ],
          body: Buffer.from(JSON.stringify({ message: 'Detalle interno ficticio de QA' })).toString('base64'),
        });
      } else {
        void cdp('Fetch.continueRequest', { requestId });
      }
    }
    const llamada = pendientes.get(id);
    if (!llamada) return;
    pendientes.delete(id);
    clearTimeout(llamada.limite);
    if (error) llamada.rechazar(new Error('Falló ' + llamada.method));
    else llamada.resolver(result);
  });

  await cdp('Page.enable');
  await cdp('Network.enable');
  await cdp('Runtime.enable');
  if (api !== apiNormal) {
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      const fetchOriginal = window.fetch.bind(window);
      window.fetch = (entrada, opciones) => fetchOriginal(
        typeof entrada === 'string' && entrada.startsWith(${JSON.stringify(apiNormal + '/')})
          ? ${JSON.stringify(api)} + entrada.slice(${apiNormal.length}) : entrada,
        opciones,
      );
    ` });
  }
  const evaluar = async (fn, datos = null) => {
    const resultado = await cdp('Runtime.evaluate', {
      expression: '(' + fn.toString() + ')(' + JSON.stringify(datos) + ')', returnByValue: true, awaitPromise: true,
    });
    if (resultado.exceptionDetails) throw new Error('Falló una comprobación en la página.');
    return resultado.result.value;
  };
  const navegar = destino => cdp('Page.navigate', { url: destino.startsWith('http') ? destino : web + destino });
  const texto = valor => hasta(() => evaluar(dato => document.querySelector('main')?.textContent.includes(dato), valor), 'Faltó: ' + valor);
  const ruta = valor => hasta(() => evaluar(dato => location.pathname === dato, valor), 'No abrió ' + valor);
  const pulsar = nombre => evaluar(dato => {
    const boton = [...document.querySelectorAll('main button, main a')].find(elemento =>
      elemento.textContent.trim() === dato || elemento.getAttribute('aria-label') === dato);
    if (!boton || boton.disabled) return false;
    boton.click();
    return true;
  }, nombre).then(hecho => assert.equal(hecho, true, 'Acción no disponible: ' + nombre));
  const escribir = (selector, valor) => evaluar(([ruta, texto]) => {
    const campo = document.querySelector(ruta);
    if (!campo) return false;
    const tipo = campo instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(tipo.prototype, 'value').set.call(campo, texto);
    campo.dispatchEvent(new Event(tipo === HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    return true;
  }, [selector, valor]).then(hecho => assert.equal(hecho, true, 'Campo no disponible: ' + selector));
  const tecla = async (key, windowsVirtualKeyCode) => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode });
  };
  const abrirMenu = async etiqueta => {
    await evaluar(nombre => document.querySelector('button[aria-label="' + nombre + '"]').focus(), etiqueta);
    await tecla('Enter', 13);
  };
  const elegirCuenta = async opcion => {
    await abrirMenu('Menú de cuenta');
    await hasta(() => evaluar(nombre => {
      const item = [...document.querySelectorAll('[role="menuitem"]')].find(el => el.textContent.trim() === nombre);
      if (!item) return false;
      item.click();
      return true;
    }, opcion), 'No abrió la opción de cuenta.');
  };
  const consultar = path => evaluar(async url => (await fetch(url, { credentials: 'include', cache: 'no-store' })).status, api + path);
  const moverReloj = () => evaluar(() => {
    const ahora = Date.now;
    Date.now = () => ahora() + 61000;
  });

  async function verificarLayout(nombre) {
    for (const ancho of [320, 390, 768, 1024, 1440]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
      for (const [tema, oscuro] of [['Claro', false], ['Oscuro', true], ['Sistema', true]]) {
        await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
        await evaluar(() => document.querySelector('button[aria-label^="Tema visual"]').focus());
        await tecla('Enter', 13);
        await hasta(() => evaluar(valor => {
          const opcion = [...document.querySelectorAll('[role="menuitemradio"]')].find(elemento => elemento.textContent.trim() === valor);
          if (!opcion) return false;
          opcion.click();
          return true;
        }, tema), 'No abrió el selector de tema con teclado.');
        await hasta(() => evaluar(([deseado, clase]) => document.documentElement.classList.contains('dark') === clase
          && Boolean(document.querySelector('button[aria-label="Tema visual: ' + deseado + '"]')), [tema, oscuro]), 'No cambió el tema.');
        const forma = await evaluar(() => {
          const panel = document.querySelector('.acceso__contenido, #contenido-panel');
          const limites = panel.getBoundingClientRect();
          const controles = [...panel.querySelectorAll('button, input, select, a, dd, [role="alert"]')];
          const rects = controles.map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
          return document.documentElement.scrollWidth <= innerWidth + 1
            && rects.every((r, i) => r.left >= limites.left - 1 && r.right <= limites.right + 1
              && rects.slice(i + 1).every(s => Math.min(r.right, s.right) - Math.max(r.left, s.left) <= 1
                || Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) <= 1));
        });
        assert.equal(forma, true, 'Desbordamiento o solapamiento en ' + nombre + ', ' + ancho + ' px, ' + tema);
      }
    }
    console.log('PASS 15 combinaciones de ancho y tema en ' + nombre + '.');
  }

  fase = 'datos y contraseña';
  const inicial = baseQa('conteos');
  await navegar('/portal/graduando');
  await ruta('/');
  await navegar('/registro/graduando');
  await texto('Datos personales');
  assert.equal(await consultar('/api/mi-sesion'), 401);
  await pulsar('Continuar');
  assert.equal(await evaluar(() => document.activeElement.id), 'nombres');
  await escribir('#nombres', nombreLargo);
  await escribir('#apellidos', 'D’Ávila');
  await escribir('#correo', correoInicial);
  await escribir('#telefono', '0310001234');
  await escribir('#tipoDocumento', 'Tarjeta de identidad');
  await escribir('#numeroDocumento', '000421');
  await verificarLayout('datos');
  await pulsar('Continuar');
  await texto('Acceso y verificación');
  await escribir('#contrasena', claveInicial);
  await escribir('#confirmacion', 'confirmación ficticia distinta');
  await texto('Confirma la contraseña con el mismo valor.');
  assert.equal(await evaluar(() => document.querySelector('#contrasena').autocomplete), 'new-password');
  await pulsar('Mostrar contraseña');
  assert.equal(await evaluar(() => document.querySelector('#contrasena').type), 'text');
  await pulsar('Ocultar contraseña');
  await escribir('#confirmacion', claveInicial);

  fase = 'errores HTTP y código inicial';
  await cdp('Fetch.enable', { patterns: [{ urlPattern: api + base + 'codigo', requestStage: 'Request' }] });
  simular = 503;
  await evaluar(() => {
    const boton = [...document.querySelectorAll('main button')].find(el => el.textContent.trim() === 'Continuar');
    boton.click();
    boton.click();
  });
  await texto('El servicio de registro no pudo completar la solicitud.');
  assert.equal(solicitudesCodigo, 1);
  assert.equal(await evaluar(correo => document.querySelector('main').textContent.includes(correo), correoInicial), false);
  assert.equal(await evaluar(() => document.body.textContent.includes('Detalle interno ficticio')), false);
  simular = 419;
  await pulsar('Reintentar envío');
  await texto('La protección de la sesión venció.');
  await cdp('Fetch.disable');
  const csrfRechazado = await evaluar(async ([url, email]) => (await fetch(url, {
    method: 'POST', credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })).status, [api + base + 'codigo', correoInicial]);
  assert.equal(csrfRechazado, 419);
  await pulsar('Reintentar envío');
  await texto('Si corresponde, recibirás un código');
  const primero = await mensaje(correoInicial, 'codigo');
  assert.equal(respuestas.get(base + 'codigo'), 202);
  await hasta(() => evaluar(() => document.activeElement.id === 'codigo-registro'), 'El foco no llegó al código.');
  const antesDeRetroceder = solicitudesCodigo;
  await pulsar('Anterior');
  await texto('Acceso y verificación');
  await pulsar('Continuar');
  await texto('Revisa tu correo');
  assert.equal(solicitudesCodigo, antesDeRetroceder);
  const incorrecto = primero === '000000' ? '000001' : '000000';
  await escribir('#codigo-registro', incorrecto);
  await pulsar('Confirmar correo');
  await texto('El código no es válido o venció.');
  assert.equal(respuestas.get(base + 'confirmacion'), 422);
  await hasta(() => evaluar(() => document.activeElement.id === 'codigo-registro'), 'El foco no regresó al código.');
  await verificarLayout('verificación con error');

  fase = 'vencimiento y reenvío';
  baseQa('vencer', correoInicial);
  await escribir('#codigo-registro', primero);
  await pulsar('Confirmar correo');
  await texto('El código no es válido o venció.');
  await moverReloj();
  await escribir('#codigo-registro', '');
  await pulsar('Reenviar código');
  await texto('Demasiados intentos.');
  assert.equal(respuestas.get(base + 'codigo'), 429);
  baseQa('habilitar-reenvio', correoInicial);
  await moverReloj();
  await escribir('#codigo-registro', '0');
  await pulsar('Reenviar código');
  const segundo = await mensaje(correoInicial, 'codigo', primero);
  await escribir('#codigo-registro', segundo);
  await pulsar('Confirmar correo');
  await texto('Correo verificado');
  console.log('PASS OTP incorrecto, vencido, reenvío, 419 real y 429 real. 503 simulado por Chrome.');

  fase = 'cambio de correo y alta';
  await pulsar('Editar datos personales');
  await escribir('#correo', correoFinal);
  await pulsar('Guardar cambios');
  await texto('Acceso y verificación');
  const antesDeCambiarCorreo = solicitudesCodigo;
  await pulsar('Continuar');
  await texto('Revisa tu correo');
  const ultimo = await mensaje(correoFinal, 'codigo');
  assert.equal(solicitudesCodigo, antesDeCambiarCorreo + 1);
  await escribir('#codigo-registro', segundo === ultimo ? incorrecto === ultimo ? '999999' : incorrecto : segundo);
  await pulsar('Confirmar correo');
  await texto('El código no es válido o venció.');
  await escribir('#codigo-registro', ultimo);
  await pulsar('Confirmar correo');
  await texto('Correo verificado');
  const resumen = await evaluar(() => document.querySelector('main').textContent);
  assert.equal(resumen.includes(claveInicial) || resumen.includes(ultimo) || resumen.includes('000421'), false);
  await verificarLayout('revisión con nombre largo');
  await evaluar(() => {
    const boton = [...document.querySelectorAll('button')].find(control => control.textContent.trim() === 'Crear cuenta');
    boton.click();
    boton.click();
  });
  await texto('Registro completado');
  assert.equal(envios, 1);
  assert.deepEqual(baseQa('cuenta'), { cantidad: 1, roles: ['graduando'], verificado: true });
  assert.deepEqual(baseQa('cuenta', correoInicial), { cantidad: 0, roles: null, verificado: false });
  assert.deepEqual(baseQa('conteos'), inicial);
  console.log('PASS cambio de correo, doble clic, alta real y cero efectos operativos.');

  fase = 'sesión del Graduando';
  const ingresar = async clave => {
    await texto('Iniciar sesión');
    await escribir('#correo', correoFinal);
    await escribir('#contrasena', clave);
    await pulsar('Iniciar sesión');
  };
  await pulsar('Ir a iniciar sesión');
  await ingresar(claveInicial);
  await ruta('/portal/graduando');
  await texto('Portal de Graduandos');
  assert.equal(await consultar('/api/mi-sesion'), 200);
  for (const destino of ['/api/administracion/cuentas', '/api/instituciones', '/api/eventos', '/api/registros']) {
    assert.equal(await consultar(destino), 403);
  }
  for (const destino of ['/AdminDashboard', '/ColaboradorDashboard', '/RegistroGraduando']) {
    await navegar(destino);
    await ruta('/portal/graduando');
  }
  await verificarLayout('portal con nombre largo');
  await elegirCuenta('Ver perfil');
  await texto('Datos de tu cuenta');
  await texto(correoFinal);
  await verificarLayout('perfil con correo y nombre largos');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 160, height: 450, deviceScaleFactor: 2, mobile: false });
  assert.equal(await evaluar(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Desbordamiento a 160 px.');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluar(() => {
    const activador = document.querySelector('button[aria-label="Abrir menú del panel"]');
    activador.focus();
    activador.click();
  });
  await hasta(() => evaluar(() => Boolean(document.querySelector('[role="dialog"]'))), 'El menú móvil no abrió.');
  await tecla('Escape', 27);
  await hasta(() => evaluar(() => document.activeElement.getAttribute('aria-label') === 'Abrir menú del panel'), 'El menú móvil no devolvió el foco.');
  await elegirCuenta('Cerrar sesión');
  await texto('Iniciar sesión');
  assert.equal(await consultar('/api/mi-sesion'), 401);
  console.log('PASS ingreso, portal, aislamiento de rutas y APIs, cierre, 401 y 403.');

  fase = 'recuperación';
  await pulsar('¿Olvidaste tu contraseña?');
  await texto('Recupera tu contraseña');
  await escribir('input[type="email"]', correoFinal);
  await pulsar('Solicitar enlace');
  const enlace = await mensaje(correoFinal, 'enlace');
  await navegar(enlace);
  await texto('Guardar nueva contraseña');
  const campos = await evaluar(() => [...document.querySelectorAll('input[type="password"]')].map(campo => '#' + campo.id));
  assert.equal(campos.length, 2);
  await escribir(campos[0], claveNueva);
  await escribir(campos[1], claveNueva);
  await pulsar('Guardar nueva contraseña');
  await texto('Contraseña actualizada');
  assert.equal(await evaluar(() => location.hash), '');
  await navegar(enlace);
  await texto('Guardar nueva contraseña');
  await escribir(campos[0], claveInicial);
  await escribir(campos[1], claveInicial);
  await pulsar('Guardar nueva contraseña');
  await texto('El enlace no es válido o venció.');
  assert.deepEqual(baseQa('cuenta'), { cantidad: 1, roles: ['graduando'], verificado: true });
  await navegar('/');
  await ingresar(claveInicial);
  await texto('El correo o la contraseña no permiten iniciar sesión.');
  await ingresar(claveNueva);
  await ruta('/portal/graduando');
  await texto('Portal de Graduandos');
  assert.equal(baseQa('vencer-sesion'), true);
  await navegar('/portal/graduando');
  await ruta('/');
  assert.equal(await consultar('/api/mi-sesion'), 401);
  const almacen = await evaluar(() => JSON.stringify({ local: { ...localStorage }, sesion: { ...sessionStorage }, url: location.href }));
  assert.equal([claveInicial, claveNueva, primero, segundo, ultimo].some(secreto => almacen.includes(secreto)), false);
  assert.equal(erroresConsola.length, 0, 'Chrome capturó excepciones de ejecución.');
  console.log('PASS recuperación por correo local, enlace de un uso, clave anterior rechazada y expiración de sesión.');
} catch (error) {
  console.error('FAIL ' + fase + '. ' + error.message);
  console.error('Últimos estados HTTP: ' + [...respuestas].map(([ruta, estado]) => ruta + ' ' + estado).join(', '));
  process.exitCode = 1;
} finally {
  conexion?.close();
  chrome.kill();
}
