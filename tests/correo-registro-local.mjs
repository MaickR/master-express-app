import { createServer as http } from 'node:http';
import { createServer as smtp } from 'node:net';

const mensajes = [];
const smtpPuerto = Number(process.env.ME_QA_SMTP_PUERTO || 2526);
const webPuerto = Number(process.env.ME_QA_CORREO_PUERTO || 8026);
const direccion = '127.0.0.1';

const correo = smtp(socket => {
  socket.setEncoding('utf8');
  socket.setTimeout(180000, () => socket.end('421 conexión inactiva\r\n'));
  socket.on('error', () => socket.destroy());
  let pendiente = '', cuerpo = null, destinatario = '';
  socket.write('220 localhost QA\r\n');
  socket.on('data', fragmento => {
    pendiente += fragmento;
    while (pendiente.includes('\r\n')) {
      const corte = pendiente.indexOf('\r\n');
      const linea = pendiente.slice(0, corte);
      pendiente = pendiente.slice(corte + 2);
      if (cuerpo !== null) {
        if (linea === '.') {
          if (destinatario) {
            const contenido = cuerpo.replace(/=\r\n/g, '').replace(/=3D/gi, '=');
            mensajes.unshift({
              destinatario,
              codigo: contenido.match(/(?:es|es=20)\s*([0-9]{6})\./)?.[1],
              enlace: contenido.match(/http:\/\/127\.0\.0\.1:5173\/restablecer-contrasena#token=[0-9a-f]{64}&(?:amp;)?email=[a-z0-9.%_+-]+/i)?.[0].replace('&amp;', '&'),
            });
            mensajes.splice(100);
          }
          cuerpo = null;
          destinatario = '';
          socket.write('250 recibido\r\n');
        } else {
          cuerpo += linea + '\r\n';
        }
      } else if (/^RCPT TO:/i.test(linea)) {
        destinatario = linea.match(/^RCPT TO:<([a-z0-9._%+-]+@example\.invalid)>/i)?.[1] || '';
        socket.write(destinatario ? '250 aceptado\r\n' : '550 solo destinatarios ficticios\r\n');
      } else if (linea === 'DATA') {
        cuerpo = '';
        socket.write('354 enviar datos\r\n');
      } else if (linea === 'QUIT') {
        socket.end('221 listo\r\n');
      } else {
        socket.write('250 OK\r\n');
      }
    }
    if (pendiente.length + (cuerpo?.length || 0) > 100000) socket.destroy();
  });
});

const escapar = valor => valor.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const bandeja = http((req, res) => {
  const host = direccion + ':' + webPuerto;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET' || req.headers.host !== host
    || (req.headers.origin && req.headers.origin !== 'http://' + host)
    || req.headers['sec-fetch-site'] === 'cross-site') {
    res.writeHead(403).end();
    return;
  }
  if (req.url === '/mensajes' && req.headers.accept === 'application/json') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(mensajes));
    return;
  }
  if (req.url !== '/') {
    res.writeHead(404).end();
    return;
  }
  const lista = mensajes.map(({ destinatario, codigo, enlace }) => '<li><strong>' + escapar(destinatario) + '</strong> · '
    + (codigo ? 'Código de registro <code>' + escapar(codigo) + '</code>'
      : enlace ? '<a href="' + escapar(enlace) + '" rel="noreferrer">Restablecer contraseña</a>' : 'Mensaje de prueba') + '</li>').join('');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Correo de pruebas MasterExpress</title><h1>Correo de pruebas MasterExpress</h1>'
    + '<p>Destinatarios ficticios <code>@example.invalid</code>. Los mensajes se conservan en memoria.</p>'
    + '<p><a href="/">Actualizar bandeja</a></p>' + (lista ? '<ul>' + lista + '</ul>' : '<p>Todavía no hay mensajes.</p>'),
  );
});

correo.listen(smtpPuerto, direccion);
bandeja.listen(webPuerto, direccion, () => process.stdout.write('Bandeja local en http://' + direccion + ':' + webPuerto + '/\n'));
