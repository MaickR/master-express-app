import { z } from 'zod';

const rolesInternos = z.enum(['administrador', 'colaborador']);
export type RolInterno = z.infer<typeof rolesInternos>;
const rolesDeSesion = z.enum([...rolesInternos.options, 'graduando', 'institucion']);
export type RolDeSesion = z.infer<typeof rolesDeSesion>;

const contratoSesion = z.object({
  data: z.object({
    id: z.number().int(),
    nombre: z.string(),
    correo: z.string(),
    roles: z.array(rolesDeSesion).nonempty(),
    cambio_clave_pendiente: z.boolean().optional(),
  }),
});
export type Identidad = z.infer<typeof contratoSesion>['data'];
export type Credenciales = { email: string; password: string; remember?: boolean };
export type DatosRestablecimiento = { email: string; token: string; password: string; password_confirmation: string };

const contratoCuentas = z.object({
  data: z.array(z.object({ id: z.number().int(), nombre: z.string(), correo: z.string(), activa: z.boolean(), principal: z.boolean(), roles: z.array(z.string()), creada_en: z.string().nullable(), acceso_disponible: z.boolean(), cambio_clave_pendiente: z.boolean() })),
  hayMas: z.boolean(),
  alta_disponible: z.boolean().optional(),
});
const rutaCuentas = '/api/administracion/cuentas';
export type AccionDeCuenta = 'suspender' | 'reactivar' | 'revocar-sesiones' | 'recuperar';

export class ErrorSesion extends Error {
  constructor(
    readonly estado: number,
    readonly espera?: number,
    readonly campos: readonly string[] = [],
    readonly aviso = '',
  ) {
    super('Falló la operación de sesión.');
  }
}

function leerCsrf(): string {
  const cookie = document.cookie.split('; ').find(valor => valor.startsWith('XSRF-TOKEN='));
  if (!cookie) throw new ErrorSesion(419);
  try {
    return decodeURIComponent(cookie.slice('XSRF-TOKEN='.length));
  } catch {
    throw new ErrorSesion(419);
  }
}

const camposSesion = ['email', 'password', 'password_confirmation', 'token'];

export async function solicitar(
  ruta: string, signal: AbortSignal, cuerpo?: object, camposValidacion: readonly string[] = camposSesion,
): Promise<Response> {
  const local = import.meta.env.DEV;
  if (local && window.location.hostname !== '127.0.0.1') throw new ErrorSesion(0);

  const puertoLocal = import.meta.env.VITE_API_LOCAL_PORT || '8000';
  if (local && (!/^\d{1,5}$/.test(puertoLocal) || Number(puertoLocal) < 1 || Number(puertoLocal) > 65535)) {
    throw new ErrorSesion(0);
  }
  const origen = local ? `http://127.0.0.1:${puertoLocal}` : window.location.origin;
  const headers = new Headers({ Accept: 'application/json' });
  if (cuerpo) {
    headers.set('Content-Type', 'application/json');
    headers.set('X-XSRF-TOKEN', leerCsrf());
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(origen + ruta, {
      method: cuerpo ? 'POST' : 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
  } catch {
    throw new ErrorSesion(0);
  }

  if (!respuesta.ok) {
    const segundos = Number(respuesta.headers.get('Retry-After'));
    const cuerpo = [409, 422].includes(respuesta.status) ? await respuesta.json().catch(() => null) : null;
    const campos = (respuesta.status === 422 ? camposValidacion : []).filter(campo =>
      cuerpo?.errors && Object.hasOwn(cuerpo.errors, campo),
    );
    const aviso = typeof cuerpo?.message === 'string'
      && (respuesta.status === 409 || (respuesta.status === 422 && cuerpo.errors === undefined))
      ? cuerpo.message
      : '';
    throw new ErrorSesion(respuesta.status, segundos > 0 && Number.isFinite(segundos) ? segundos : undefined, campos, aviso);
  }

  return respuesta;
}

export async function consultarSesion(signal: AbortSignal): Promise<Identidad> {
  const respuesta = await solicitar('/api/mi-sesion', signal);
  const resultado = contratoSesion.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success) throw new ErrorSesion(0);
  return resultado.data.data;
}

export async function consultarCuentas(pagina: number, signal: AbortSignal, filtros: Record<string, string> = {}) {
  const parametros = new URLSearchParams({ page: String(pagina) });
  for (const [clave, valor] of Object.entries(filtros)) if (valor.trim()) parametros.set(clave, valor.trim());
  const respuesta = await solicitar(rutaCuentas + '?' + parametros, signal);
  const resultado = contratoCuentas.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success) throw new ErrorSesion(0);
  return resultado.data;
}

export async function operarCuenta(id: number, accion: AccionDeCuenta): Promise<void> {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  await solicitar(`${rutaCuentas}/${id}`, signal, { accion });
}

export async function iniciarSesion(datos: Credenciales, signal: AbortSignal): Promise<Identidad> {
  await solicitar('/sanctum/csrf-cookie', signal);
  try {
    await solicitar('/login', signal, datos);
  } catch (error) {
    if (!(error instanceof ErrorSesion) || error.estado !== 409) throw error;
    try {
      return await consultarSesion(signal);
    } catch (reconciliacion) {
      if (reconciliacion instanceof ErrorSesion && reconciliacion.estado === 401) throw error;
      throw reconciliacion;
    }
  }
  return consultarSesion(signal);
}

export async function recuperarContrasena(datos: { email: string } | DatosRestablecimiento, signal: AbortSignal) {
  await solicitar('/sanctum/csrf-cookie', signal);
  await solicitar('token' in datos ? '/reset-password' : '/forgot-password', signal, datos);
}

export async function terminarSesion(signal: AbortSignal): Promise<void> {
  try {
    await solicitar('/sanctum/csrf-cookie', signal);
    await solicitar('/logout', signal, {});
  } catch (error) {
    if (!(error instanceof ErrorSesion) || ![401, 403].includes(error.estado)) throw error;
  }
}

const rutaSolicitudes = '/api/administracion/solicitudes-institucionales';
const camposSolicitud = ['motivo', 'solicitud'];

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';
export type ResumenSolicitud = {
  id: number;
  estado: EstadoSolicitud;
  tipo: 'colegio' | 'universidad';
  razon_social: string;
  nit: string;
  sede: string;
  representante: string;
  email: string;
  telefono: string;
  cuenta_existente: boolean;
  creada_en: string | null;
  notificacion_estado: string | null;
};
export type DetalleSolicitud = ResumenSolicitud & {
  correo_verificado_en: string | null;
  requiere_activacion: boolean;
  activada_en: string | null;
  institucion_id: number | null;
  sede_id: number | null;
  decision: { estado: string; en: string; administrador_id: number | null; motivo: string | null } | null;
  notificacion: { estado: string; detalle: string | null } | null;
};
export type AmbitoInstitucional = {
  vinculo_id: number;
  institucion_id: number;
  nombre: string | null;
  tipo: string | null;
  nit: string | null;
  sede: { id: number; nombre: string } | null;
  representante: string | null;
  correo: string;
  correo_verificado: boolean;
};

async function leerJson<T>(respuesta: Response, esquema: { safeParse: (dato: unknown) => { success: boolean; data?: T } }): Promise<T> {
  const resultado = esquema.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success || resultado.data === undefined) throw new ErrorSesion(0);
  return resultado.data;
}

const resumenSolicitud = z.object({
  id: z.number().int(),
  estado: z.enum(['pendiente', 'aprobada', 'rechazada']),
  tipo: z.enum(['colegio', 'universidad']),
  razon_social: z.string(),
  nit: z.string(),
  sede: z.string(),
  representante: z.string(),
  email: z.string(),
  telefono: z.string(),
  cuenta_existente: z.boolean(),
  creada_en: z.string().nullable(),
  notificacion_estado: z.string().nullable(),
});
const paginaSolicitudes = z.object({
  data: z.array(resumenSolicitud),
  hayMas: z.boolean(),
});
const detalleSolicitud = z.object({
  data: resumenSolicitud.extend({
    correo_verificado_en: z.string().nullable(),
    requiere_activacion: z.boolean(),
    activada_en: z.string().nullable(),
    institucion_id: z.number().int().nullable(),
    sede_id: z.number().int().nullable(),
    decision: z.object({
      estado: z.string(),
      en: z.string(),
      administrador_id: z.number().int().nullable(),
      motivo: z.string().nullable(),
    }).nullable(),
    notificacion: z.object({
      estado: z.string(),
      detalle: z.string().nullable(),
    }).nullable(),
  }),
});
const ambitoInstitucional = z.object({
  data: z.array(z.object({
    vinculo_id: z.number().int().positive(),
    institucion_id: z.number().int(),
    nombre: z.string().nullable(),
    tipo: z.string().nullable(),
    nit: z.string().nullable(),
    sede: z.object({ id: z.number().int(), nombre: z.string() }).nullable(),
    representante: z.string().nullable(),
    correo: z.string(),
    correo_verificado: z.boolean(),
  })),
});

export async function listarSolicitudesInstitucionales(
  estado: EstadoSolicitud, pagina: number, signal: AbortSignal,
) {
  const respuesta = await solicitar(`${rutaSolicitudes}?estado=${estado}&page=${pagina}`, signal);
  return leerJson(respuesta, paginaSolicitudes);
}

export async function consultarSolicitudInstitucional(id: number, signal: AbortSignal) {
  const respuesta = await solicitar(`${rutaSolicitudes}/${id}`, signal);
  return leerJson(respuesta, detalleSolicitud);
}

export async function decidirSolicitudInstitucional(id: number, decision: 'aprobacion' | 'rechazo', motivo?: string) {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  const cuerpo = decision === 'rechazo' ? { motivo } : {};
  const respuesta = await solicitar(`${rutaSolicitudes}/${id}/${decision}`, signal, cuerpo, camposSolicitud);
  return leerJson(respuesta, detalleSolicitud);
}

export async function reintentarAvisoInstitucional(id: number) {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  await solicitar(`${rutaSolicitudes}/${id}/notificacion`, signal, {}, camposSolicitud);
}

const graduandoOperativo = z.object({
  id: z.number().int(),
  nombre_completo: z.string(),
  homonimo: z.boolean(),
  vinculo: z.object({
    id: z.number().int(),
    estado: z.enum(['activo', 'anulado']),
    cuenta_id: z.number().int(),
    cuenta_nombre: z.string().nullable(),
    cuenta_correo: z.string().nullable(),
    decidida_en: z.string().nullable(),
    anulado_en: z.string().nullable(),
    motivo: z.string().nullable(),
  }).nullable(),
  anteriores: z.array(z.object({
    id: z.number().int(),
    estado: z.enum(['activo', 'anulado']),
    cuenta_id: z.number().int(),
    cuenta_nombre: z.string().nullable(),
    cuenta_correo: z.string().nullable(),
    decidida_en: z.string().nullable(),
    anulado_en: z.string().nullable(),
    motivo: z.string().nullable(),
  })),
});
const paginaGraduandos = z.object({
  data: z.array(graduandoOperativo),
  hayMas: z.boolean(),
});
const paginaCuentasGraduando = z.object({
  data: z.array(z.object({
    id: z.number().int(),
    nombre: z.string(),
    correo: z.string(),
  })),
  hayMas: z.boolean(),
});
const vinculoGraduandoCreado = z.object({
  data: z.object({
    id: z.number().int(),
    estado: z.literal('activo'),
    graduando: z.object({
      id: z.number().int(),
      nombre_completo: z.string(),
      homonimo: z.boolean(),
    }),
    cuenta: z.object({
      id: z.number().int(),
      nombre: z.string(),
      correo: z.string(),
    }),
    decidida_en: z.string().nullable(),
    administrador: z.object({
      id: z.number().int(),
      nombre: z.string(),
    }),
  }),
});
export type GraduandoOperativo = z.infer<typeof graduandoOperativo>;
export type VinculoGraduandoCreado = z.infer<typeof vinculoGraduandoCreado>['data'];
const rutaVinculos = '/api/administracion/vinculos-graduandos';

export async function listarGraduandosOperativos(pagina: number, signal: AbortSignal) {
  const respuesta = await solicitar(`${rutaVinculos}/graduandos?page=${pagina}`, signal);
  return leerJson(respuesta, paginaGraduandos);
}

export async function listarCuentasGraduando(pagina: number, signal: AbortSignal) {
  const respuesta = await solicitar(`${rutaVinculos}/cuentas?page=${pagina}`, signal);
  return leerJson(respuesta, paginaCuentasGraduando);
}

export async function vincularGraduando(graduandoId: number, cuentaId: number) {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  const respuesta = await solicitar(rutaVinculos, signal, {
    graduando_id: graduandoId,
    cuenta_id: cuentaId,
  });
  return leerJson(respuesta, vinculoGraduandoCreado);
}

const vinculoAnulado = z.object({
  data: z.object({
    id: z.number().int(),
    estado: z.literal('anulado'),
    cuenta_id: z.number().int(),
    cuenta_nombre: z.string().nullable(),
    anulado_en: z.string().nullable(),
    motivo: z.string().nullable(),
  }),
});
const correccionVinculo = vinculoGraduandoCreado.extend({
  anterior: z.object({
    id: z.number().int().nullable(),
    estado: z.literal('anulado'),
    cuenta_id: z.number().int().nullable(),
    cuenta_nombre: z.string().nullable(),
    graduando_id: z.number().int().nullable(),
  }),
});

export async function anularVinculoGraduando(id: number, motivo: string) {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  const respuesta = await solicitar(`${rutaVinculos}/${id}/anulacion`, signal, { motivo });
  return leerJson(respuesta, vinculoAnulado);
}

export async function corregirVinculoGraduando(id: number, cuentaId: number, motivo: string) {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  const respuesta = await solicitar(`${rutaVinculos}/${id}/correccion`, signal, { motivo, cuenta_id: cuentaId });
  return leerJson(respuesta, correccionVinculo);
}

export async function consultarMiInstitucion(signal: AbortSignal) {
  const respuesta = await solicitar('/api/mi-institucion', signal);
  return leerJson(respuesta, ambitoInstitucional);
}

export function mensajeSesion(error: unknown): string {
  if (error instanceof ErrorSesion) {
    switch (error.estado) {
      case 401: return 'Tu sesión terminó. Inicia sesión de nuevo.';
      case 403: return 'Tu cuenta no tiene acceso a MasterExpress Control.';
      case 409: return 'Ya hay una sesión iniciada. Recarga la página para continuar.';
      case 419: return 'La protección de la sesión venció. Inténtalo de nuevo.';
      case 422: return 'El correo o la contraseña no permiten iniciar sesión.';
      case 429: return error.espera
        ? `Demasiados intentos. Espera ${Math.ceil(error.espera)} segundos antes de volver a intentar.`
        : 'Demasiados intentos. Espera un momento antes de volver a intentar.';
      case 0: return 'No pudimos conectar con el servicio. Comprueba la conexión y vuelve a intentar.';
    }
  }
  return 'El servicio de acceso no pudo completar la solicitud. Inténtalo de nuevo.';
}
