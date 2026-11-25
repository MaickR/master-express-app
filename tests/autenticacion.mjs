// Con Vite y Laravel activos: node tests/autenticacion.mjs "chrome.exe" "carpeta de capturas"
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const [ejecutable, capturas] = process.argv.slice(2);
assert(ejecutable && capturas, 'Indica el ejecutable del navegador y la carpeta de capturas.');

const web = 'http://127.0.0.1:5173';
const api = 'http://127.0.0.1:8000';
const carpetaApi = fileURLToPath(new URL('../apps/api', import.meta.url));
const perfil = await mkdtemp(join(tmpdir(), 'me-auth1b-'));
const sufijo = randomBytes(10).toString('hex');
const correo = rol => 'qa-' + rol + '-' + sufijo + '@example.invalid';
const cuentas = [
  { email: correo('admin'), nombre: 'Laura Moreno', roles: ['administrador'] },
  { email: correo('colab'), nombre: 'Camila Ruiz', roles: ['colaborador'] },
  { email: correo('doble'), nombre: 'Daniel Ortiz', roles: ['administrador', 'colaborador'] },
];
const clave = randomBytes(18).toString('hex');
const script = join(perfil, 'cuentas.php');

// Aprovisiona datos ficticios en la base autorizada sin registrar credenciales.
await writeFile(script, String.raw`<?php
require 'vendor/autoload.php';

try {
    $entrada = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $app = require 'bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $db = Illuminate\Support\Facades\DB::connection();
    if (!$app->environment('local') || $db->getDriverName() !== 'mysql'
        || $db->getConfig('host') !== '127.0.0.1'
        || $db->selectOne('SELECT DATABASE() AS nombre')->nombre !== 'masterexpress_control_dev') {
        exit(2);
    }
    $db->transaction(function () use ($entrada, $db) {
        foreach ($entrada['cuentas'] as $cuenta) {
            $usuarios = App\Models\User::query()->where('email', $cuenta['email'])->where('name', $cuenta['nombre']);
            if ($entrada['accion'] === 'limpiar') {
                $db->table('sessions')->whereIn('user_id', $usuarios->pluck('id'))->delete();
                $usuarios->delete();
            } elseif ($entrada['accion'] === 'revocar' && $cuenta['roles'] === ['colaborador']) {
                $usuarios->sole()->roles()->detach();
            } elseif ($entrada['accion'] === 'crear') {
                $roles = App\Models\Rol::query()->whereIn('codigo', $cuenta['roles'])->pluck('id');
                if ($roles->count() !== count($cuenta['roles'])) {
                    throw new RuntimeException('Catálogo de roles incompleto');
                }
                $persona = App\Models\User::create([
                    'email' => $cuenta['email'], 'name' => $cuenta['nombre'], 'password' => $entrada['clave'],
                ]);
                $persona->roles()->attach($roles);
            }
        }
    });
} catch (Throwable $error) {
    fwrite(STDERR, "No se pudo gestionar la cuenta ficticia.\n");
    exit(1);
}
`);

const administrarCuentas = accion => {
  const resultado = spawnSync('php', [script], {
    cwd: carpetaApi, input: JSON.stringify({ accion, cuentas, clave: accion === 'crear' ? clave : undefined }),
    encoding: 'utf8', windowsHide: true, timeout: 10000,
  });
  assert.equal(resultado.status, 0, 'No se pudo ' + accion + ' las cuentas ficticias en MySQL de desarrollo.');
};

async function hasta(consulta, mensaje) {
  for (let intento = 0; intento < 100; intento++) {
    const resultado = await consulta();
    if (resultado) return resultado;
    await esperar(120);
  }
  throw new Error(mensaje);
}

let chrome, conexion, preparadas = false;
try {
  assert.equal((await fetch(web)).status, 200, 'Vite debe escuchar en 127.0.0.1:5173.');
  assert.equal((await fetch(api + '/api/salud')).status, 200, 'Laravel debe escuchar en 127.0.0.1:8000.');
  await mkdir(capturas, { recursive: true });
  administrarCuentas('crear');
  preparadas = true;

  chrome = spawn(ejecutable, [
    '--headless', '--disable-background-networking', '--no-first-run', '--remote-debugging-port=0',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--user-data-dir=' + perfil,
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const puerto = await hasta(async () => {
    const datos = await readFile(join(perfil, 'DevToolsActivePort'), 'utf8').catch(() => '');
    return Number(datos.split('\n')[0]);
  }, 'El navegador no abrió el puerto de depuración.');
  const pestañas = await (await fetch('http://127.0.0.1:' + puerto + '/json/list')).json();
  conexion = new WebSocket(pestañas.find(pagina => pagina.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    conexion.addEventListener('open', resolver, { once: true });
    conexion.addEventListener('error', rechazar, { once: true });
  });

  let numero = 0, envios = 0;
  const pendientes = new Map();
  conexion.addEventListener('message', ({ data }) => {
    const evento = JSON.parse(data);
    if (evento.method === 'Network.requestWillBeSent' && evento.params.request.url === api + '/login'
      && evento.params.request.method === 'POST') envios++;
    const llamada = pendientes.get(evento.id);
    if (!llamada) return;
    pendientes.delete(evento.id);
    clearTimeout(llamada.temporizador);
    if (evento.error) llamada.rechazar(new Error('Falló ' + llamada.metodo));
    else llamada.resolver(evento.result);
  });

  const cdp = (metodo, params = {}) => new Promise((resolver, rechazar) => {
    const id = ++numero;
    const temporizador = setTimeout(() => {
      pendientes.delete(id);
      rechazar(new Error('Tiempo agotado en ' + metodo));
    }, 18000);
    pendientes.set(id, { resolver, rechazar, temporizador, metodo });
    conexion.send(JSON.stringify({ id, method: metodo, params }));
  });

  const leer = async (fn, dato) => {
    const expression = '(' + fn.toString() + ')(' + JSON.stringify(dato ?? null) + ')';
    const resultado = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (resultado.exceptionDetails) throw new Error('Falló una comprobación en el navegador.');
    return resultado.result.value;
  };

  const navegar = ruta => cdp('Page.navigate', { url: web + ruta });
  const redimensionar = (width, height = 900) => cdp('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  const pantalla = async nombre => {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(capturas, nombre + '.png'), Buffer.from(data, 'base64'));
  };
  const texto = esperada => leer(valor => document.body.textContent.includes(valor), esperada);
  const seleccionar = selector => leer(valor => Boolean(document.querySelector(valor)), selector);
  const clic = selector => leer(valor => document.querySelector(valor).click(), selector);
  const mensaje = () => leer(() => document.querySelector('[role="alert"]')?.textContent.trim());
  const loginVisible = () => hasta(() => seleccionar('#correo'), 'No apareció el formulario de ingreso.');
  const panel = (ruta, encabezado) => hasta(
    () => leer(([path, titulo]) => location.pathname === path && document.querySelector('main h1')?.textContent.includes(titulo), [ruta, encabezado]),
    'No abrió el panel autorizado ' + ruta,
  );
  const digitar = (email, password, veces = 1) => leer(datos => {
    document.querySelector('#correo').value = datos.email;
    document.querySelector('#contrasena').value = datos.password;
    for (let i = 0; i < datos.veces; i++) document.querySelector('form').requestSubmit();
  }, { email, password, veces });

  const tecla = async (key, code, virtual) => {
    const datos = { key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual };
    await cdp('Input.dispatchKeyEvent', key === 'Enter'
      ? { ...datos, type: 'keyDown', text: '\r', unmodifiedText: '\r' }
      : { ...datos, type: 'rawKeyDown' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual });
  };

  await cdp('Page.enable');
  await cdp('Network.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: '(' + (([colaborador, doble]) => {
      localStorage.setItem('admin_id', 'usuario-legado-ficticio');
      localStorage.setItem('admin_rol', 'presidente');
      localStorage.setItem('colaborador_id', 'id-inventado');
      localStorage.setItem('master-express:local:Colaborador', JSON.stringify([
        { id: 'col-qa', nombre_completo: 'Camila Ruiz', email: colaborador, activo: true },
        { id: 'col-doble', nombre_completo: 'Daniel Ortiz', email: doble, activo: true },
      ]));
      const fecha = new Date().toISOString().slice(0, 10);
      localStorage.setItem('master-express:local:Evento', JSON.stringify([
        { id: 'ea', nombre_institucion: 'Institución de prueba', activo: true, fecha },
      ]));
      localStorage.setItem('master-express:local:Graduando', JSON.stringify([
        { id: 'qa1', nombre_completo: 'Mariana Silva', colaborador_id: 'col-qa', evento_id: 'ea', eliminado: false,
          estado_pago: 'completo', abono: 120000, valor_total: 120000, fecha, paquete: 'digital' },
        { id: 'qa2', nombre_completo: 'Santiago Rojas', colaborador_id: 'col-doble', eliminado: false,
          estado_pago: 'pendiente', abono: 40000, valor_total: 120000, fecha, paquete: 'fisico' },
      ]));
    }).toString() + ')(' + JSON.stringify([cuentas[1].email, cuentas[2].email]) + ')',
  });

  await redimensionar(1440);
  await navegar('/AdminDashboard');
  await loginVisible();
  assert.equal(await leer(() => location.pathname), '/');
  await hasta(() => leer(() => document.querySelector('header img')?.naturalWidth > 0), 'No cargó el logotipo.');
  await pantalla('01-login-1440');
  for (const ancho of [320, 390, 768, 1440]) {
    await redimensionar(ancho, 900);
    assert(await leer(width => innerWidth === width && document.documentElement.scrollWidth <= width
      && document.querySelector('button[type="submit"]').getBoundingClientRect().bottom < innerHeight, ancho));
    if (ancho === 390) await pantalla('02-login-390');
  }
  console.log('PASS A/F/Q Login anónimo, URL privada bloqueada incluso con localStorage legado y cuatro anchos.');

  await tecla('Tab', 'Tab', 9);
  assert.equal(await leer(() => document.activeElement.id), 'correo');
  await tecla('Tab', 'Tab', 9);
  assert.equal(await leer(() => document.activeElement.id), 'contrasena');
  await tecla('Tab', 'Tab', 9);
  assert.equal(await leer(() => document.activeElement.getAttribute('aria-label')), 'Mostrar contraseña');
  await tecla(' ', 'Space', 32);
  assert.equal(await leer(() => document.querySelector('#contrasena').type), 'text');
  await tecla(' ', 'Space', 32);
  assert.equal(await leer(() => document.querySelector('#contrasena').type), 'password');
  await tecla('Tab', 'Tab', 9);
  await tecla('Enter', 'Enter', 13);
  await hasta(() => leer(() => document.activeElement.id === 'correo'), 'La validación no enfocó el correo.');
  console.log('PASS P Navegación, validación y visibilidad de contraseña por teclado.');

  await digitar(cuentas[0].email, 'incorrecta');
  const rechazo = await hasta(mensaje, 'No apareció el error de contraseña.');
  assert.match(rechazo, /correo o la contraseña/);
  await digitar(correo('ausente'), clave);
  assert.equal(await hasta(mensaje, 'No apareció el error de cuenta inexistente.'), rechazo);

  await leer(() => {
    const peticion = window.fetch;
    window.fetch = (url, opciones) => {
      if (url.endsWith('/login') && opciones.method === 'POST') {
        window.fetch = peticion;
        const headers = new Headers(opciones.headers);
        headers.delete('X-XSRF-TOKEN');
        return peticion(url, { ...opciones, headers });
      }
      return peticion(url, opciones);
    };
  });
  await digitar(cuentas[0].email, clave);
  assert.match(await hasta(mensaje, 'No apareció el error de CSRF.'), /protección de la sesión/);
  console.log('PASS H/I/L Mensaje idéntico para credenciales rechazadas y Laravel rechazó la petición sin CSRF.');

  const enviosPrevios = envios;
  await digitar(cuentas[0].email, clave, 2);
  await panel('/AdminDashboard', 'Panel de administración');
  assert.equal(envios - enviosPrevios, 1);
  await pantalla('03-panel-administrador-1440');
  await navegar('/AdminDashboard');
  await panel('/AdminDashboard', 'Panel de administración');
  await navegar('/ColaboradorDashboard');
  await panel('/AdminDashboard', 'Panel de administración');
  await navegar('/RegistroGraduando');
  await panel('/AdminDashboard', 'Panel de administración');
  await clic('[aria-label="Cerrar sesión"]');
  await loginVisible();
  await navegar('/AdminDashboard');
  await loginVisible();
  console.log('PASS B/D/E/G/K/O Administrador, recarga, rol ajeno rechazado, logout y un solo envío.');

  await digitar(cuentas[1].email, clave);
  await panel('/ColaboradorDashboard', 'Mi panel');
  await hasta(() => texto('Mariana Silva'), 'No apareció el graduando ficticio vinculado.');
  assert.equal(await texto('Santiago Rojas'), false);
  await pantalla('04-panel-colaborador-1440');
  await navegar('/RegistroGraduando');
  await panel('/RegistroGraduando', 'Registrar Nuevo Graduando');
  await navegar('/AdminDashboard');
  await panel('/ColaboradorDashboard', 'Mi panel');
  administrarCuentas('revocar');
  await leer(() => window.dispatchEvent(new Event('focus')));
  await loginVisible();
  assert.match(await mensaje(), /no tiene acceso/);
  console.log('PASS C/D/G/J Colaborador, registro protegido, panel ajeno bloqueado y revocación de sesión.');

  // Crea la sesión antes de que el proveedor la haya observado, para recibir 409 al usar el formulario.
  assert.equal(await leer(async ({ base, email, password }) => {
    await fetch(base + '/sanctum/csrf-cookie', { credentials: 'include' });
    const token = document.cookie.split('; ').find(valor => valor.startsWith('XSRF-TOKEN='));
    const respuesta = await fetch(base + '/login', {
      method: 'POST', credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token.slice(11)) },
      body: JSON.stringify({ email, password }),
    });
    return respuesta.status;
  }, { base: api, email: cuentas[2].email, password: clave }), 204);
  await digitar(cuentas[2].email, clave);
  await hasta(() => texto('Selecciona un panel'), 'No se reconcilió la sesión activa.');
  await clic('a[href="/ColaboradorDashboard"]');
  await panel('/ColaboradorDashboard', 'Mi panel');
  await clic('[aria-label="Cambiar de panel"]');
  await hasta(() => texto('Selecciona un panel'), 'No abrió el selector.');
  await clic('a[href="/AdminDashboard"]');
  await panel('/AdminDashboard', 'Panel de administración');
  await clic('[aria-label="Cerrar sesión"]');
  await loginVisible();
  console.log('PASS 409 y selector limitado a los dos roles de la cuenta.');

  await cdp('Network.setBlockedURLs', { urls: [api + '/*'] });
  await navegar('/');
  await hasta(() => texto('Acceso no disponible'), 'No apareció el error de conexión.');
  await cdp('Network.setBlockedURLs', { urls: [] });
  await clic('main button');
  await loginVisible();
  for (let intento = 0; intento < 5; intento++) {
    await digitar(correo('ausente'), clave);
    const resultado = await hasta(mensaje, 'No respondió el limitador de Laravel.');
    if (/Demasiados intentos/.test(resultado)) {
      assert(await leer(() => document.querySelector('button[type="submit"]').disabled));
      break;
    }
    assert(intento < 4, 'Laravel no devolvió el límite de intentos.');
  }
  console.log('PASS M/N Limitación real 429 y recuperación tras error de conexión.');
} finally {
  conexion?.close();
  chrome?.kill();
  try {
    if (preparadas) administrarCuentas('limpiar');
  } finally {
    await rm(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {});
  }
}
