// Ensayos focalizados sobre una instancia MySQL nueva; no abren bases previas.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as esperar } from 'node:timers/promises';

if (process.env.ME_QA_ACEPTACION_HUMANA === 'true' || (process.argv.includes('--servir') && !process.argv.includes('--automatizado'))) {
  throw new Error('Este ejecutor crea datos temporales. Para aceptación usa npm run dev:local -- --aceptacion; para pruebas indica --automatizado.');
}
console.log('Proceso de ensayo automatizado:', process.pid);
const raiz = fileURLToPath(new URL('../', import.meta.url));
const graduandos = process.argv.includes('--graduandos');
const eventos = process.argv.includes('--eventos');
const suite = graduandos ? ['tests/MySql/GestionGraduandosTest.php', 'tests/MySql/RegistrosTest.php', 'tests/MySql/VinculacionGraduandosTest.php', 'tests/MySql/GestionGraduandosConcurrenciaTest.php'] : eventos
  ? ['tests/MySql/EventosTest.php', 'tests/MySql/RegistrosTest.php', 'tests/MySql/ProgramacionInstitucionalTest.php', 'tests/Feature/EnsayoEventosTest.php']
  : ['tests/MySql/AdminCoreTest.php'];
const chrome = graduandos ? 'tests/graduandos-chrome.mjs' : eventos ? 'tests/eventos-chrome.mjs' : 'tests/admin-core-chrome.mjs';
const api = join(raiz, 'apps/api');
const baseTemporal = process.env.ME_QA_TEMP_DIR || tmpdir();
await mkdir(baseTemporal, { recursive: true });
const carpeta = await mkdtemp(join(baseTemporal, graduandos ? 'me-ops2c-' : eventos ? 'me-ops2a-' : 'me-admin-core-'));
const datos = join(carpeta, 'mysql');
const bin = 'C:/Program Files/MySQL/MySQL Server 9.1/bin';
const puerto = 3338;
await new Promise((resolve, reject) => {
  const reserva = createServer();
  reserva.once('error', () => reject(new Error('El puerto automatizado 3338 está ocupado; no se abrirá ni modificará esa instancia.')));
  reserva.listen(puerto, '127.0.0.1', () => reserva.close(resolve));
});
const procesos = [];
const claveRoot = randomBytes(24).toString('hex');
const claveDb = randomBytes(24).toString('hex');
const env = { ...process.env, ME_QA_AUTOMATIZADO: 'true', ME_QA_MYSQL_PORT: String(puerto),
  ME_QA_WEB_PORT: '5189', ME_QA_API_PORT: '8018', APP_ENV: 'testing', APP_DEBUG: 'false',
  APP_KEY: 'base64:' + randomBytes(32).toString('base64'), APP_URL: 'http://127.0.0.1:5189', ME_QA_SPA_URL: 'http://127.0.0.1:5189', SPA_ALLOWED_ORIGINS: 'http://127.0.0.1:5189',
  APP_CONFIG_CACHE: join(carpeta, 'config-no-cache.php'),
  DB_CONNECTION: 'mysql_pruebas', DB_URL: '', ME_MYSQL_TEST_PORT: String(puerto),
  ME_MYSQL_TEST_USERNAME: 'qa_admin_core', ME_MYSQL_TEST_PASSWORD: claveDb,
  SESSION_DRIVER: 'database', SESSION_CONNECTION: 'mysql_pruebas', SESSION_DOMAIN: '',
  SESSION_SECURE_COOKIE: 'false', SESSION_COOKIE: 'me_admin_core_qa',
  CACHE_STORE: 'array', QUEUE_CONNECTION: 'database', MAIL_MAILER: 'array',
  MAIL_URL: '', MAIL_FROM_ADDRESS: 'qa@example.invalid', LOG_CHANNEL: 'null',
  SANCTUM_STATEFUL_DOMAINS: '127.0.0.1:5189,127.0.0.1:8018', BCRYPT_ROUNDS: '4',
};

function ejecutar(cmd, args, entrada, opciones = {}) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(cmd, args, { cwd: api, env, windowsHide: true, ...opciones, stdio: ['pipe', 'pipe', 'pipe'] });
    let salida = '';
    hijo.stdout.on('data', dato => { salida += dato; });
    hijo.stderr.on('data', dato => { salida += dato; });
    hijo.on('error', reject);
    hijo.on('close', codigo => codigo === 0 ? resolve(salida) : reject(new Error(`Falló ${cmd} (${codigo}): ${salida}`)));
    hijo.stdin.end(entrada);
  });
}
function iniciar(cmd, args, opciones = {}) {
  const hijo = spawn(cmd, args, { cwd: api, env, windowsHide: true, stdio: 'ignore', ...opciones });
  procesos.push(hijo);
  return hijo;
}
try {
  await mkdir(datos);
  await ejecutar(join(bin, 'mysqld.exe'), ['--no-defaults', '--initialize-insecure', `--datadir=${datos}`]);
  iniciar(join(bin, 'mysqld.exe'), ['--no-defaults', `--datadir=${datos}`, `--port=${puerto}`, '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin', '--console']);
  for (let intento = 0; ; intento++) {
    try { await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uroot', '-e', 'SELECT 1']); break; }
    catch { if (intento > 60) throw new Error('MySQL aislado no inició.'); await esperar(500); }
  }
  await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uroot'],
    `CREATE DATABASE masterexpress_control_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     CREATE USER 'qa_admin_core'@'127.0.0.1' IDENTIFIED BY '${claveDb}';
     GRANT ALL ON masterexpress_control_test.* TO 'qa_admin_core'@'127.0.0.1';
     ALTER USER 'root'@'localhost' IDENTIFIED BY '${claveRoot}';`);
  console.log('PASS MySQL nuevo en 127.0.0.1:3338; esquema aislado, cuenta restringida y credenciales aleatorias en memoria.');
  if (graduandos) {
    const anteriores = join(carpeta, 'migraciones-previas');
    await mkdir(anteriores);
    for (const archivo of await readdir(join(api, 'database/migrations'))) {
      if (!archivo.startsWith('2026_11_28_000014')) await copyFile(join(api, 'database/migrations', archivo), join(anteriores, archivo));
    }
    console.log(await ejecutar('php', ['artisan', 'migrate', '--path=' + anteriores, '--realpath', '--force']));
    await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uqa_admin_core', 'masterexpress_control_test'],
      "INSERT INTO graduandos (id,nombre_completo) VALUES (702,'Registro previo ficticio QA');", { env: { ...env, MYSQL_PWD: claveDb } });
    const respaldo = await ejecutar(join(bin, 'mysqldump.exe'), ['--no-defaults', '--host=127.0.0.1', `--port=${puerto}`, '--user=qa_admin_core', '--single-transaction', '--no-tablespaces', 'masterexpress_control_test'], undefined, { env: { ...env, MYSQL_PWD: claveDb } });
    await writeFile(join(carpeta, 'respaldo-sintetico-previo.sql'), respaldo);
    await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uroot'],
      'CREATE DATABASE masterexpress_respaldo_ops2c CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;', { env: { ...env, MYSQL_PWD: claveRoot } });
    await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uroot', 'masterexpress_respaldo_ops2c'], respaldo, { env: { ...env, MYSQL_PWD: claveRoot } });
    const restaurado = await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uroot', '--batch', '--skip-column-names', 'masterexpress_respaldo_ops2c', '-e', 'SELECT id,nombre_completo FROM graduandos WHERE id=702'], undefined, { env: { ...env, MYSQL_PWD: claveRoot } });
    if (restaurado.trim() !== '702\tRegistro previo ficticio QA') throw new Error('No coincidió el respaldo restaurado.');
    console.log('PASS Respaldo transaccional y restauración del esquema previo en clon aislado.');
  }
  console.log(await ejecutar('php', ['artisan', 'migrate', '--database=mysql_pruebas', '--force']));
  if (graduandos) {
    const legado = await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uqa_admin_core', '--batch', '--skip-column-names', 'masterexpress_control_test', '-e', 'SELECT id,nombre_completo,revision,creado_por,numero_documento FROM graduandos WHERE id=702'], undefined, { env: { ...env, MYSQL_PWD: claveDb } });
    if (legado.trim() !== '702\tRegistro previo ficticio QA\t1\tNULL\tNULL') throw new Error('La migración no conservó el registro previo.');
    await ejecutar(join(bin, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', `-P${puerto}`, '-uqa_admin_core', 'masterexpress_control_test', '-e', 'DELETE FROM graduandos WHERE id=702'], undefined, { env: { ...env, MYSQL_PWD: claveDb } });
    console.log('PASS Migración aditiva: identidad y nombre previos intactos; documento y actor sin atribución inventada.');
  }

  console.log(await ejecutar('php', ['artisan', 'db:seed', '--class=RolSeeder', '--force']));
  try { if (!process.argv.includes('--solo-chrome')) console.log(await ejecutar('php', ['vendor/phpunit/phpunit/phpunit', ...suite])); }
  catch (error) { console.log(error.message); if (!process.argv.includes('--iterar')) throw error; }
  if (!process.argv.includes('--servir')) process.exitCode = 0;
  else {
    const semilla = join(carpeta, 'semilla.php');
    await writeFile(semilla, String.raw`<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
abort_unless($app->environment('testing') && config('database.default') === 'mysql_pruebas', 403);
$entrada = json_decode(stream_get_contents(STDIN), true);
$usuario = App\Models\User::create(['name' => 'Administrador automatizado', 'email' => 'administracion-automatizada@example.invalid', 'password' => $entrada['clave']]);
$usuario->roles()->attach(App\Models\Rol::where('codigo', 'administrador')->firstOrFail()->id);
$usuario->forceFill(['principal' => true])->saveOrFail();
echo 'PASS Identidad sintética creada exclusivamente en instancia nueva; buzón sin verificar.';
`);
    // La credencial de automatización solo vive en memoria y se entrega por stdin.
    const claveQa = randomBytes(24).toString('hex');
    if (eventos || graduandos) {
      console.log(await ejecutar('php', ['artisan', 'qa:ensayo-eventos', 'preparar'], undefined, { env: { ...env, ME_QA_CLAVE: claveQa } }));
    } else {
      console.log(await ejecutar('php', [semilla], JSON.stringify({ clave: claveQa })));
    }
    iniciar('php', ['-S', '127.0.0.1:8018', '../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php'], { cwd: join(api, 'public') });
    iniciar(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'apps/web/vite.config.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'],
      { cwd: raiz, env: { ...env, VITE_BASE44_DATOS_LOCALES: 'true', VITE_API_LOCAL_PORT: '8018', ME_QA_VITE_CACHE_DIR: join(carpeta, 'vite-cache') } });
    console.log('PASS Servicios QA iniciados: http://127.0.0.1:5189/; Laravel 8018.');
    if (process.argv.includes('--chrome')) {
      try { console.log(await ejecutar(process.execPath, [join(raiz, chrome), carpeta], JSON.stringify({ clave: claveQa }), { cwd: raiz })); } catch (error) { console.log(error.message); if (!process.argv.includes('--iterar')) throw error; }
    }
    console.log(`Evidencia QA: ${carpeta}`);
    if (!process.argv.includes('--chrome') || process.argv.includes('--iterar')) {
    const comandos = createInterface({ input: process.stdin });
    comandos.on('line', async linea => {
      try {
        if (linea === 'cerrar') process.emit('SIGINT');
        if (linea === 'phpunit') console.log(await ejecutar('php', ['vendor/phpunit/phpunit/phpunit', ...suite]));
        if (linea === 'chrome') console.log(await ejecutar(process.execPath, [join(raiz, chrome), carpeta], JSON.stringify({ clave: claveQa }), { cwd: raiz }));
      } catch (error) { console.log(error.message); }
    });
    await new Promise(resolve => { process.on('SIGINT', resolve); process.on('SIGTERM', resolve); });
    comandos.close();
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try { await ejecutar(join(bin, 'mysqladmin.exe'), ['--no-defaults', '--host=127.0.0.1', `--port=${puerto}`, '--user=root', 'shutdown'], undefined, { env: { ...env, MYSQL_PWD: claveRoot } }); } catch {}
  for (const hijo of procesos.reverse()) hijo.kill();
}
