// Reutiliza exclusivamente el entorno heredado del ensayo que ya está activo.
// No lee archivos de entorno ni acepta contraseñas por argumentos, archivos o logs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function ejecutarDesbloqueo(carpeta, orden) {
  const api = fileURLToPath(new URL('../apps/api/', import.meta.url));
  const diagnostico = await new Promise((resolve, reject) => {
    const hijo = spawn('php', ['tests/soporte-admin-core.php'], { cwd: api, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let salida = '';
    hijo.stdout.on('data', dato => { salida += dato; });
    hijo.on('error', reject);
    hijo.on('close', codigo => codigo === 0 ? resolve(JSON.parse(salida)) : reject(new Error('El diagnóstico QA no pudo validar la conexión.')));
    hijo.stdin.end(JSON.stringify({ accion: 'diagnostico-ernesto' }));
  });
  assert.equal(diagnostico.entorno, 'testing');
  assert.equal(diagnostico.base, 'masterexpress_control_test');
  assert.equal(diagnostico.puerto_mysql, 3328);
  assert.equal(diagnostico.correo, 'array');
  await writeFile(join(carpeta, 'diagnostico-ernesto.json'), JSON.stringify(diagnostico, null, 2));
  console.log(JSON.stringify(diagnostico, null, 2));
  if (orden === 'diagnostico') return;
  if (orden === 'persistir') {
    const nombres = ['APP_ENV', 'APP_DEBUG', 'APP_KEY', 'APP_URL', 'ME_QA_SPA_URL', 'SPA_ALLOWED_ORIGINS',
      'APP_CONFIG_CACHE', 'DB_CONNECTION', 'DB_URL', 'ME_MYSQL_TEST_PORT', 'ME_MYSQL_TEST_USERNAME',
      'ME_MYSQL_TEST_PASSWORD', 'SESSION_DRIVER', 'SESSION_CONNECTION', 'SESSION_DOMAIN', 'SESSION_SECURE_COOKIE',
      'SESSION_COOKIE', 'CACHE_STORE', 'QUEUE_CONNECTION', 'MAIL_MAILER', 'MAIL_URL', 'MAIL_FROM_ADDRESS',
      'LOG_CHANNEL', 'SANCTUM_STATEFUL_DOMAINS', 'BCRYPT_ROUNDS'];
    const entorno = Object.fromEntries(nombres.map(nombre => [nombre, process.env[nombre] ?? '']));
    entorno.ME_QA_ACEPTACION_HUMANA = 'true';
    entorno.VITE_API_LOCAL_PORT = '8008';
    entorno.VITE_BASE44_DATOS_LOCALES = 'true';
    const script = fileURLToPath(new URL('../scripts/aceptacion-local.ps1', import.meta.url));
    await new Promise((resolve, reject) => {
      const hijo = spawn('powershell.exe', ['-NoProfile', '-File', script, '-GuardarConfiguracion'],
        { cwd: api, windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
      hijo.on('error', reject);
      hijo.on('close', codigo => codigo === 0 ? resolve() : reject(new Error('No se pudo proteger la configuración local de aceptación.')));
      hijo.stdin.end(JSON.stringify({ version: 1, carpeta, directorioDatos: diagnostico.directorio_datos, entorno }));
    });
    console.log('PASS Configuración de la instancia existente protegida con DPAPI del usuario Windows; sin contraseña del propietario.');
    return;
  }
  if (orden === 'aceptacion') {
    await (await import('./observar-ernesto-chrome.mjs')).observarAceptacion(carpeta);
    return;
  }

  assert.equal(diagnostico.cuentas_objetivo, 1, 'Se requiere exactamente una cuenta existente; no se crean duplicados.');
  const cuenta = diagnostico.cuentas[0];
  assert(cuenta.roles.includes('administrador'));
  assert(Number.isSafeInteger(cuenta.id) && cuenta.id > 0);
  // El propietario introduce su clave en una consola real con secret(..., false).
  const script = fileURLToPath(new URL('../scripts/establecer-clave-qa.ps1', import.meta.url));
  const ps = `
$ErrorActionPreference = 'Stop'
$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-File','"${script}"','-CuentaId','${cuenta.id}','-CarpetaResultado','"${carpeta}"') -WindowStyle Normal -PassThru -Wait
exit $p.ExitCode
`;
  const codigo = await new Promise((resolve, reject) => {
    const hijo = spawn('powershell.exe', ['-NoProfile', '-Command', ps], { cwd: api, windowsHide: true, stdio: 'ignore' });
    hijo.on('error', reject);
    hijo.on('close', resolve);
  });
  await writeFile(join(carpeta, 'preparacion-ernesto.json'), JSON.stringify({ id: cuenta.id, resultado: codigo === 0 ? 'PASS' : 'FAIL', codigo }));
  assert.equal(codigo, 0, 'La preparación no se completó. No se crea otra identidad.');
  console.log(`PASS Cuenta existente #${cuenta.id} preparada mediante entrada oculta del propietario.`);
}
