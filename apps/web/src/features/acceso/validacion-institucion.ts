export const etiquetasInstitucion = {
  tipo: 'Tipo de institución',
  razonSocial: 'Razón social',
  nit: 'NIT',
  sede: 'Sede',
  representante: 'Nombre completo',
  correo: 'Correo electrónico',
  telefono: 'Teléfono',
} as const;

export const tiposInstitucion = [
  { valor: 'colegio', etiqueta: 'Colegio' },
  { valor: 'universidad', etiqueta: 'Universidad' },
] as const;

export type SolicitudInstitucionalCliente = {
  tipo: string;
  razonSocial: string;
  nit: string;
  sede: string;
  representante: string;
  correo: string;
  telefono: string;
};

const nombre = /^\p{L}[\p{L}\p{M}\p{Zs}\p{Pd}.‘’']*$/u;
const institucional = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\p{Zs}\p{Pd}.&'’(),]*$/u;
const nit = /^[0-9]+(?:-[0-9]+)?$/;

export const normalizarCorreoInstitucional = (correo = '') => correo.trim().toLowerCase();

/** Reglas equivalentes al contrato Laravel de la solicitud institucional. */
export function validarSolicitudInstitucional(
  datos: SolicitudInstitucionalCliente, correoInvalido = false,
): Partial<Record<keyof SolicitudInstitucionalCliente, string>> {
  const errores: Partial<Record<keyof SolicitudInstitucionalCliente, string>> = {};
  const tipo = datos.tipo.trim();
  const razonSocial = datos.razonSocial.trim();
  const sede = datos.sede.trim();
  const representante = datos.representante.trim();
  const valorNit = datos.nit.trim();
  const telefono = datos.telefono.trim();
  const correo = normalizarCorreoInstitucional(datos.correo);

  if (!tiposInstitucion.some(opcion => opcion.valor === tipo)) {
    errores.tipo = 'Selecciona Colegio o Universidad.';
  }
  if (!razonSocial || razonSocial.length > 200 || !institucional.test(razonSocial)) {
    errores.razonSocial = 'Ingresa la razón social (hasta 200 caracteres).';
  }
  if (!valorNit || valorNit.length > 30 || !nit.test(valorNit)) {
    errores.nit = 'Ingresa el NIT con dígitos. Si usas un guion, debe separar dos grupos.';
  }
  if (!sede || sede.length > 150 || !institucional.test(sede)) {
    errores.sede = 'Ingresa la sede (hasta 150 caracteres).';
  }
  if (!representante || representante.length > 150 || !nombre.test(representante)) {
    errores.representante = 'Ingresa el nombre completo con letras y signos propios del nombre (hasta 150 caracteres).';
  }
  if (!correo || correo.length > 254 || correoInvalido) {
    errores.correo = 'Ingresa un correo electrónico válido.';
  }
  const digitos = telefono.replace(/\D/g, '').length;
  if (!/^\+?[\d\s().-]+$/.test(telefono) || digitos < 7 || digitos > 15) {
    errores.telefono = 'Ingresa entre 7 y 15 dígitos. Puedes incluir el indicativo.';
  }
  return errores;
}
