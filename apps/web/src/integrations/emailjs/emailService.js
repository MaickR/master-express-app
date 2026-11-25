/**
 * emailService.js
 * Servicio centralizado de envío de correos con EmailJS
 * para Master Express Eventos
 */

import { base44 } from "@/integrations/base44/base44Client";
import emailjs from "@emailjs/browser";

export const EMAIL_TYPES = {
  REGISTRO_GRADUANDO: "registro_graduando",
  ENTREGA_FOTOGRAFIAS: "entrega_fotografias",
};

export const EMAIL_LABELS = {
  registro_graduando: "Registro de Graduando",
  entrega_fotografias: "Entrega de Fotografías",
};

export const DEFAULT_SUBJECTS = {
  registro_graduando: "Confirmación de registro - Master Express Eventos",
  entrega_fotografias: "Tus fotografías están listas - Master Express Eventos",
};

export const DEFAULT_SALUDO = {
  registro_graduando: "Tu registro en Master Express Eventos ha sido confirmado exitosamente. A continuación encontrarás el resumen completo de tu registro y del paquete adquirido. Te invitamos a verificar que todos tus datos personales estén correctamente registrados.",
  entrega_fotografias: "Tus fotografías de graduación ya están listas. Para coordinar la entrega o descarga de tu material fotográfico, comunícate con nosotros a través de nuestros canales de atención.",
};

export const DEFAULT_MENSAJE_FINAL = {
  registro_graduando: "Si encuentras algún error en la información registrada, comunícate de inmediato con Master Express Eventos para realizar la respectiva corrección.",
  entrega_fotografias: "",
};

const formatCurrency = (v) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0);

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
};

// ─── HTML corporativo profesional ─────────────────────────────────────────────

function baseLayout(content, firma = "") {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>Master Express Eventos</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#e8eef5;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Wrapper exterior -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#e8eef5">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <!-- Contenedor principal: 600px máximo -->
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(15,40,80,0.13);">

        <!-- ══ ENCABEZADO ══ -->
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#0d2d52 0%,#1a4a7a 45%,#2e6fab 100%);padding:0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" style="padding:44px 40px 36px;">
                  <!-- Logo / Marca tipográfica -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 20px;">
                    <tr>
                      <td align="center" style="background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.25);border-radius:12px;padding:14px 28px;">
                        <span style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:3px;text-transform:uppercase;">MASTER EXPRESS</span>
                      </td>
                    </tr>
                  </table>
                  <!-- Título -->
                  <h1 style="margin:0 0 8px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.4px;line-height:1.2;text-align:center;">Confirmaci&#243;n de Registro</h1>
                  <!-- Subtítulo -->
                  <p style="margin:0 0 6px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;font-weight:600;color:rgba(255,255,255,0.88);text-align:center;letter-spacing:0.5px;">Master Express Eventos</p>
                  <!-- Tagline -->
                  <p style="margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:12px;color:rgba(255,255,255,0.60);text-align:center;letter-spacing:0.8px;text-transform:uppercase;">Fotograf&#237;a Profesional &nbsp;&bull;&nbsp; Grados &nbsp;&bull;&nbsp; Eventos Acad&#233;micos</p>
                </td>
              </tr>
              <!-- Barra de acento inferior del header -->
              <tr>
                <td style="background:linear-gradient(90deg,#4a9ede 0%,#89c4f4 50%,#4a9ede 100%);height:4px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ CUERPO ══ -->
        <tr>
          <td style="padding:40px 44px 32px;">
            ${content}
          </td>
        </tr>

        <!-- ══ FIRMA PERSONALIZADA ══ -->
        ${firma ? `
        <tr>
          <td style="padding:0 44px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #dde4ed;">
              <tr><td style="padding:20px 0 0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;color:#5a6a7a;line-height:1.7;">${firma}</td></tr>
            </table>
          </td>
        </tr>` : ""}

        <!-- ══ SEPARADOR ══ -->
        <tr>
          <td style="padding:0 44px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #dde4ed;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
        </tr>

        <!-- ══ FOOTER ══ -->
        <tr>
          <td align="center" style="background-color:#f4f7fb;padding:28px 44px 32px;border-radius:0 0 16px 16px;">
            <p style="margin:0 0 6px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;font-weight:800;color:#0d2d52;text-align:center;letter-spacing:0.5px;">MASTER EXPRESS EVENTOS</p>
            <p style="margin:0 0 10px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:12px;color:#7a8fa6;text-align:center;">Especialistas en fotograf&#237;a de graduaciones &nbsp;&bull;&nbsp; Alquiler de togas y birretes</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 12px;">
              <tr>
                <td style="background-color:#dde4ed;height:1px;width:60px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
            <p style="margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:11px;color:#a0aec0;text-align:center;line-height:1.6;">Este mensaje fue generado autom&#225;ticamente. Por favor no respondas directamente a este correo.<br>Si tienes alguna duda, comun&#237;cate directamente con nuestro equipo.</p>
          </td>
        </tr>

      </table>
      <!-- FIN contenedor principal -->

    </td>
  </tr>
</table>

</body>
</html>`;
}

// Fila de dato: etiqueta 40%, valor 60%, sin emojis
function dataRow(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `
    <tr>
      <td width="40%" style="padding:11px 16px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;color:#6b7a8d;background-color:#f7f9fc;border-bottom:1px solid #e4eaf2;vertical-align:top;white-space:nowrap;">${label}</td>
      <td width="60%" style="padding:11px 16px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;color:#1a2940;font-weight:600;background-color:#ffffff;border-bottom:1px solid #e4eaf2;vertical-align:top;word-break:break-word;">${value}</td>
    </tr>`;
}

// Tarjeta de sección con título en mayúsculas
function sectionCard(title, rows) {
  if (!rows || !rows.trim()) return "";
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:0 0 10px;">
          <p style="margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:10px;font-weight:800;color:#1a4a7a;text-transform:uppercase;letter-spacing:1.4px;">${title}</p>
        </td>
      </tr>
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:10px;overflow:hidden;border:1px solid #e4eaf2;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>`;
}

export function buildEmailHTML(tipo, data = {}, config = {}) {
  const firma = config.firma || "";
  const extra = config.texto_adicional
    ? `<p style="margin:20px 0 0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;color:#5a6a7a;line-height:1.75;text-align:justify;">${config.texto_adicional}</p>`
    : "";

  const saludoTexto = config.saludo || DEFAULT_SALUDO[tipo] || "";
  const mensajeFinalTexto = config.mensaje_final !== undefined
    ? config.mensaje_final
    : (DEFAULT_MENSAJE_FINAL[tipo] || "");

  const paqueteLabels = { digital: "Digital", fisico: "F&#237;sico", fisico_digital: "F&#237;sico + Digital" };
  const medioPagoLabels = {
    efectivo: "Efectivo", transferencia: "Transferencia bancaria",
    nequi: "Nequi", daviplata: "Daviplata", tarjeta: "Tarjeta", otro: "Otro"
  };

  switch (tipo) {

    // ── REGISTRO GRADUANDO ──────────────────────────────────────────────────
    case EMAIL_TYPES.REGISTRO_GRADUANDO: {
      const {
        nombre, telefono, correo, direccion, barrio, ciudad,
        programa_academico, paquete, valor_total, abono, saldo,
        medio_pago, evento, ceremonia, colaborador, fecha
      } = data;

      const saldoNum = Number(saldo) || 0;
      const pagoCompleto = saldoNum <= 0;

      // Banner de estado de pago — sin emojis, solo texto y color
      const estadoBanner = pagoCompleto
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border-radius:10px;overflow:hidden;background-color:#f0fdf4;border:1px solid #bbf7d0;">
            <tr>
              <td style="padding:5px 0 0;background:linear-gradient(90deg,#22c55e,#16a34a);height:4px;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:18px 24px;">
                <p style="margin:0 0 4px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;font-weight:800;color:#14532d;text-transform:uppercase;letter-spacing:0.5px;">Pago Completado</p>
                <p style="margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;color:#15803d;line-height:1.5;">No tienes saldo pendiente. Gracias por tu pago oportuno.</p>
              </td>
            </tr>
          </table>`
        : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border-radius:10px;overflow:hidden;background-color:#fffbeb;border:1px solid #fde68a;">
            <tr>
              <td style="padding:5px 0 0;background:linear-gradient(90deg,#f59e0b,#d97706);height:4px;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:18px 24px;">
                <p style="margin:0 0 4px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;font-weight:800;color:#78350f;text-transform:uppercase;letter-spacing:0.5px;">Saldo Pendiente: ${formatCurrency(saldoNum)}</p>
                <p style="margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;color:#b45309;line-height:1.5;">Recuerda cancelar el saldo pendiente antes de la ceremonia de graduaci&#243;n.</p>
              </td>
            </tr>
          </table>`;

      const personalRows =
        dataRow("Nombre completo", nombre || "&#8212;") +
        dataRow("Tel&#233;fono", telefono) +
        dataRow("Correo electr&#243;nico", correo) +
        dataRow("Direcci&#243;n", direccion) +
        dataRow("Barrio", barrio) +
        dataRow("Ciudad", ciudad) +
        dataRow("Carrera / Programa", programa_academico);

      const eventoRows =
        dataRow("Evento", evento) +
        dataRow("Ceremonia", ceremonia) +
        (fecha ? dataRow("Fecha de registro", formatDate(fecha)) : "");

      const pagoRows =
        dataRow("Paquete adquirido", paqueteLabels[paquete] || paquete || "&#8212;") +
        dataRow("Valor total", formatCurrency(valor_total)) +
        dataRow("Abono realizado", formatCurrency(abono)) +
        dataRow("Saldo pendiente", formatCurrency(saldoNum)) +
        dataRow("Medio de pago", medioPagoLabels[medio_pago] || medio_pago) +
        (colaborador ? dataRow("Registrado por", colaborador) : "");

      const mensajeFinalBlock = mensajeFinalTexto
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;border-radius:10px;overflow:hidden;background-color:#f0f6ff;border-left:4px solid #1a4a7a;">
            <tr><td style="padding:16px 20px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;color:#1e3a5f;line-height:1.75;text-align:justify;">${mensajeFinalTexto}</td></tr>
          </table>` : "";

      const content = `
        <!-- Saludo personalizado -->
        <p style="margin:0 0 6px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:20px;font-weight:800;color:#0d2d52;">Hola, ${nombre || "graduando"}:</p>
        ${saludoTexto ? `<p style="margin:0 0 28px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;color:#5a6a7a;line-height:1.75;text-align:justify;">${saludoTexto}</p>` : ""}

        ${sectionCard("Informaci&#243;n Personal", personalRows)}
        ${eventoRows.trim() ? sectionCard("Evento y Ceremonia", eventoRows) : ""}
        ${sectionCard("Paquete y Pago", pagoRows)}

        ${estadoBanner}
        ${mensajeFinalBlock}
        ${extra}`;

      return baseLayout(content, firma);
    }

    // ── ENTREGA DE FOTOGRAFÍAS ──────────────────────────────────────────────
    case EMAIL_TYPES.ENTREGA_FOTOGRAFIAS: {
      const { nombre, evento } = data;

      const mensajeFinalBlock = mensajeFinalTexto
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 0;border-radius:10px;overflow:hidden;background-color:#f0f6ff;border-left:4px solid #1a4a7a;">
            <tr><td style="padding:16px 20px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;color:#1e3a5f;line-height:1.75;text-align:justify;">${mensajeFinalTexto}</td></tr>
          </table>` : "";

      // Header override para entrega
      const contenidoEntrega = `
        <p style="margin:0 0 6px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:20px;font-weight:800;color:#0d2d52;">Hola, ${nombre || "graduando"}:</p>
        ${saludoTexto ? `<p style="margin:0 0 28px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;color:#5a6a7a;line-height:1.75;text-align:justify;">${saludoTexto}</p>` : ""}
        ${sectionCard("Detalle de Entrega",
          dataRow("Evento", evento) +
          dataRow("Estado del material", "Listo para entrega")
        )}
        ${mensajeFinalBlock}
        ${extra}`;

      // Para entrega de fotos, cambiamos el título del header
      const htmlBase = baseLayout(contenidoEntrega, firma);
      return htmlBase.replace("Confirmaci&#243;n de Registro", "Fotograf&#237;as Listas para Entrega");
    }

    default:
      return baseLayout(`<p style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;color:#1a2940;text-align:justify;">${data.mensaje || ""}</p>`, firma);
  }
}

// ─── Core Send Function ───────────────────────────────────────────────────────

export async function sendEmail({ to_email, to_name, subject, html_body, tipo, graduando_id, ejsConfig }) {
  const { service_id, template_id, public_key } = ejsConfig || {};

  if (!service_id || !template_id || !public_key) {
    throw new Error("EmailJS no está configurado. Configure las credenciales en la sección de Correos.");
  }

  if (!to_email || typeof to_email !== "string" || to_email.trim() === "") {
    throw new Error("No se encontró un correo electrónico válido para este destinatario.");
  }

  const cleanEmail = to_email.trim();
  const remitente = ejsConfig.nombre_remitente || "Master Express Eventos";
  const correoRemitente = ejsConfig.correo_remitente || "";

  const templateParams = {
    to_email: cleanEmail,
    to_name: to_name || "",
    subject: subject,
    html_body: html_body,
    from_name: remitente,
    from_email: correoRemitente,
    reply_to: correoRemitente,
    reply_to_name: remitente,
    sender_name: remitente,
  };

  let estado = "enviado";
  let errorMsg = null;

  try {
    await emailjs.send(service_id, template_id, templateParams, public_key);
  } catch (err) {
    estado = "error";
    errorMsg = err?.text || err?.message || String(err);
    throw err;
  } finally {
    await base44.entities.EmailLog.create({
      destinatario: cleanEmail,
      nombre_destinatario: to_name || "",
      tipo,
      asunto: subject,
      estado,
      error: errorMsg || undefined,
      graduando_id: graduando_id || undefined,
    }).catch(() => {});
  }
}

// ─── High-level helper: envío automático al registrar graduando ───────────────

export async function sendRegistroGraduandoEmail(graduando, extraData = {}) {
  const correoGraduando = graduando?.correo?.trim();
  if (!correoGraduando) return { skipped: true, reason: "sin correo registrado" };

  const [ejsConfigs, cfgRows] = await Promise.all([
    base44.entities.EmailJSConfig.list(),
    base44.entities.EmailConfig.filter({ tipo: EMAIL_TYPES.REGISTRO_GRADUANDO }),
  ]);

  const ejsConfig = ejsConfigs[0] || {};
  if (!ejsConfig.service_id || !ejsConfig.template_id || !ejsConfig.public_key) {
    return { skipped: true, reason: "EmailJS no configurado" };
  }

  const cfg = cfgRows[0] || {};
  if (cfg.activo === false) return { skipped: true, reason: "tipo desactivado" };

  const asunto = cfg.asunto || DEFAULT_SUBJECTS[EMAIL_TYPES.REGISTRO_GRADUANDO];
  const html_body = buildEmailHTML(EMAIL_TYPES.REGISTRO_GRADUANDO, {
    nombre: graduando.nombre_completo,
    telefono: graduando.telefono,
    correo: graduando.correo,
    direccion: graduando.direccion,
    barrio: graduando.barrio,
    ciudad: graduando.ciudad,
    programa_academico: graduando.programa_academico,
    paquete: graduando.paquete,
    valor_total: graduando.valor_total,
    abono: graduando.abono,
    saldo: graduando.saldo,
    medio_pago: graduando.medio_pago,
    fecha: graduando.fecha,
    ...extraData,
  }, cfg);

  await sendEmail({
    to_email: correoGraduando,
    to_name: graduando.nombre_completo,
    subject: asunto,
    html_body,
    tipo: EMAIL_TYPES.REGISTRO_GRADUANDO,
    graduando_id: graduando.id,
    ejsConfig,
  });

  return { success: true };
}

// Kept for backward compatibility (entrega de fotografías)
export async function sendGraduandoEmail(tipo, graduando, extraData = {}) {
  const correoGraduando = graduando?.correo?.trim();
  if (!correoGraduando) return { skipped: true, reason: "sin correo registrado" };

  const [ejsConfigs, cfgRows] = await Promise.all([
    base44.entities.EmailJSConfig.list(),
    base44.entities.EmailConfig.filter({ tipo }),
  ]);

  const ejsConfig = ejsConfigs[0] || {};
  const cfg = cfgRows[0] || {};
  if (cfg.activo === false) return { skipped: true, reason: "tipo desactivado" };

  const asunto = cfg.asunto || DEFAULT_SUBJECTS[tipo] || "Mensaje de Master Express Eventos";
  const html_body = buildEmailHTML(tipo, { ...extraData, nombre: graduando.nombre_completo }, cfg);

  await sendEmail({
    to_email: correoGraduando,
    to_name: graduando.nombre_completo,
    subject: asunto,
    html_body,
    tipo,
    graduando_id: graduando.id,
    ejsConfig,
  });

  return { success: true };
}