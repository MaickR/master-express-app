export type CampoRegistro = {
  id: 'nombres' | 'apellidos' | 'correo' | 'telefono' | 'tipoDocumento' | 'numeroDocumento'
    | 'contrasena' | 'confirmacion' | 'razonSocial' | 'nit' | 'sede' | 'responsable' | 'tipoInstitucion';
  etiqueta: string;
  tipo: 'text' | 'nombre' | 'email' | 'tel' | 'nit' | 'password' | 'tipoDocumento' | 'numeroDocumento' | 'tipoInstitucion';
  limite?: number;
  opcional?: boolean;
};

export type DatosRegistro = Partial<Record<CampoRegistro['id'], string>>;

export const tiposDocumento = ['Cédula de ciudadanía', 'Tarjeta de identidad'] as const;
export function soloDigitosDocumento(valor: string) {
  return !/[^0-9]/.test(valor);
}
export const errorNumeroDocumento = 'Ingresa únicamente dígitos del 0 al 9.';
export const errorNit = 'Ingresa el NIT con dígitos. Si usas un guion, debe separar dos grupos.';

export function permiteEditarNit(valor: string) {
  return !/[^0-9-]/.test(valor) && /^(?:[0-9]+(?:-[0-9]*)?)?$/.test(valor);
}

type PasoRegistro = {
  corto: string;
  titulo: string;
  campos: readonly CampoRegistro[];
  verificacion?: boolean;
};

export type VistaRegistro = {
  ruta: string;
  enlace: string;
  titulo: string;
  revision: string;
  accion: string;
  avisoFinal?: string;
  registroPublico?: true;
  solicitudPublica?: true;
  pasos: readonly [PasoRegistro, PasoRegistro];
};

export const vistasRegistro: readonly VistaRegistro[] = [
  {
    ruta: '/registro/graduando',
    enlace: 'Soy graduando',
    titulo: 'Registro de graduando',
    revision: 'Revisa tus datos',
    accion: 'Crear cuenta',
    registroPublico: true,
    pasos: [
      {
        corto: 'Datos',
        titulo: 'Datos personales',
        campos: [
          { id: 'nombres', etiqueta: 'Nombres', tipo: 'nombre' },
          { id: 'apellidos', etiqueta: 'Apellidos', tipo: 'nombre' },
          { id: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', limite: 254 },
          { id: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', limite: 30 },
          { id: 'tipoDocumento', etiqueta: 'Documento de identidad', tipo: 'tipoDocumento', opcional: true },
          { id: 'numeroDocumento', etiqueta: 'Número de documento', tipo: 'numeroDocumento', limite: 32 },
        ],
      },
      {
        corto: 'Acceso',
        titulo: 'Acceso y verificación',
        verificacion: true,
        campos: [
          { id: 'contrasena', etiqueta: 'Contraseña', tipo: 'password', limite: 128 },
          { id: 'confirmacion', etiqueta: 'Confirma la contraseña', tipo: 'password', limite: 128 },
        ],
      },
    ],
  },
  {
    ruta: '/registro/institucion',
    enlace: 'Soy institución',
    titulo: 'Registro de institución',
    revision: 'Revisa los datos de la solicitud',
    accion: 'Enviar solicitud',
    solicitudPublica: true,
    pasos: [
      {
        corto: 'Institución',
        titulo: 'Información institucional',
        campos: [
          { id: 'tipoInstitucion', etiqueta: 'Tipo de institución', tipo: 'tipoInstitucion' },
          { id: 'razonSocial', etiqueta: 'Razón social', tipo: 'text', limite: 200 },
          { id: 'nit', etiqueta: 'NIT', tipo: 'nit', limite: 30 },
          { id: 'sede', etiqueta: 'Sede', tipo: 'text', limite: 150 },
        ],
      },
      {
        corto: 'Representante',
        titulo: 'Persona representante',
        verificacion: true,
        campos: [
          { id: 'responsable', etiqueta: 'Nombre completo', tipo: 'nombre' },
          { id: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', limite: 254 },
          { id: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', limite: 30 },
        ],
      },
    ],
  },
];

export function validarCampoRegistro(campo: CampoRegistro, datos: DatosRegistro, correoInvalido: boolean) {
  const original = datos[campo.id] ?? '';
  const valor = original.trim();
  if (campo.tipo === 'numeroDocumento') {
    if (!datos.tipoDocumento) return;
    if (!original) return 'Ingresa el número del documento seleccionado.';
    return soloDigitosDocumento(original) ? undefined : errorNumeroDocumento;
  }
  if (!valor) return campo.opcional ? undefined : `Completa «${campo.etiqueta}» para continuar.`;

  switch (campo.tipo) {
    case 'nombre':
      if (!/^\p{L}[\p{L}\p{M}\p{Zs}\p{Pd}.‘’']*$/u.test(valor)) return 'Usa letras, espacios o signos propios del nombre.';
      break;
    case 'email':
      if (correoInvalido) return 'Ingresa un correo electrónico válido.';
      break;
    case 'tel': {
      const digitos = valor.replace(/\D/g, '').length;
      if (!/^\+?[\d\s().-]+$/.test(valor) || digitos < 7 || digitos > 15) {
        return 'Ingresa entre 7 y 15 dígitos. Puedes incluir el indicativo.';
      }
      break;
    }
    case 'tipoDocumento':
      if (!tiposDocumento.some(tipo => tipo === valor)) return 'Selecciona un tipo de documento de la lista.';
      break;
    case 'tipoInstitucion':
      if (valor !== 'colegio' && valor !== 'universidad') return 'Selecciona Colegio o Universidad.';
      break;
    case 'nit':
      if (!permiteEditarNit(original) || original.endsWith('-')) return errorNit;
      break;
    case 'password':
      if (campo.id === 'confirmacion') {
        if (original !== datos.contrasena) return 'Confirma la contraseña con el mismo valor.';
      } else if ([...original].length < 12) {
        return 'Usa al menos 12 caracteres.';
      } else if (new TextEncoder().encode(original).length > 72 || original.includes('\0')) {
        return 'Usa una contraseña más corta.';
      }
      break;
  }
}
