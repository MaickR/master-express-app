import { z } from 'zod';

const rolesInternos = z.enum(['administrador', 'colaborador']);
export type RolInterno = z.infer<typeof rolesInternos>;

const contratoSesion = z.object({
  data: z.object({
    id: z.number().int(),
    nombre: z.string(),
    correo: z.string(),
    roles: z.array(rolesInternos).nonempty(),
  }),
});
export type Identidad = z.infer<typeof contratoSesion>['data'];
export type Credenciales = { email: string; password: string; remember?: boolean };
export type DatosRestablecimiento = { email: string; token: string; password: string; password_confirmation: string };

const contratoCuentas = z.object({
  data: z.array(z.object({ id: z.number().int(), nombre: z.string(), correo: z.string(), activa: z.boolean() })),
  hayMas: z.boolean(),
});
const rutaCuentas = '/api/administracion/cuentas';
export type AccionDeCuenta = 'suspender' | 'reactivar' | 'revocar-sesiones';

export class ErrorSesion extends Error {
  constructor(readonly estado: number, readonly espera?: number, readonly campos: readonly string[] = []) {
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

  const origen = local ? 'http://127.0.0.1:8000' : window.location.origin;
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
    const validacion = respuesta.status === 422 ? await respuesta.json().catch(() => null) : null;
    const campos = camposValidacion.filter(campo =>
      validacion?.errors && Object.hasOwn(validacion.errors, campo),
    );
    throw new ErrorSesion(respuesta.status, segundos > 0 && Number.isFinite(segundos) ? segundos : undefined, campos);
  }

  return respuesta;
}

export async function consultarSesion(signal: AbortSignal): Promise<Identidad> {
  const respuesta = await solicitar('/api/mi-sesion', signal);
  const resultado = contratoSesion.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success) throw new ErrorSesion(0);
  return resultado.data.data;
}

export async function consultarCuentas(pagina: number, signal: AbortSignal) {
  const respuesta = await solicitar(`${rutaCuentas}?page=${pagina}`, signal);
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
