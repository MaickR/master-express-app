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
export type Credenciales = { email: string; password: string };

export class ErrorSesion extends Error {
  constructor(readonly estado: number, readonly espera?: number) {
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

async function solicitar(ruta: string, signal: AbortSignal, cuerpo?: object): Promise<Response> {
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
    throw new ErrorSesion(respuesta.status, segundos > 0 && Number.isFinite(segundos) ? segundos : undefined);
  }

  return respuesta;
}

export async function consultarSesion(signal: AbortSignal): Promise<Identidad> {
  const respuesta = await solicitar('/api/mi-sesion', signal);
  const resultado = contratoSesion.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success) throw new ErrorSesion(0);
  return resultado.data.data;
}

export async function iniciarSesion(datos: Credenciales, signal: AbortSignal): Promise<Identidad> {
  await solicitar('/sanctum/csrf-cookie', signal);
  try {
    await solicitar('/login', signal, datos);
  } catch (error) {
    if (!(error instanceof ErrorSesion) || error.estado !== 409) throw error;
  }
  return consultarSesion(signal);
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
      case 419: return 'La protección de la sesión venció. Inténtalo de nuevo.';
      case 422: return 'El correo o la contraseña no permiten iniciar sesión.';
      case 429: return error.espera
        ? `Demasiados intentos. Espera ${Math.ceil(error.espera)} segundos antes de volver a intentar.`
        : 'Demasiados intentos. Espera un momento antes de volver a intentar.';
      case 0: return 'No pudimos conectar con Laravel. Comprueba la conexión y vuelve a intentar.';
    }
  }
  return 'El servicio de acceso no pudo completar la solicitud. Inténtalo de nuevo.';
}
