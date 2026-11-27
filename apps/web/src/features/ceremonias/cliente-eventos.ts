import { z } from 'zod';
import { ErrorSesion, mensajeSesion, solicitar } from '@/features/acceso/cliente-sesion';

type MetadatosVite = ImportMeta & { readonly env: { readonly DEV: boolean; readonly MODE: string } };

/**
 * ! El ensayo con Laravel solo se activa en el servidor local de Vite con `--mode ensayo-laravel`.
 * La compilación fija `DEV` en falso, por lo que la operación real sigue en Base44.
 */
export const ensayoLaravel: boolean = Boolean((import.meta as MetadatosVite).env.DEV)
  && (import.meta as MetadatosVite).env.MODE === 'ensayo-laravel'
  && window.location.hostname === '127.0.0.1';

const contratoInstitucion = z.object({ id: z.number().int(), nombre: z.string(), tipo: z.string() });
const contratoCeremonia = z.object({
  id: z.number().int(),
  evento_id: z.number().int(),
  nombre: z.string(),
  hora: z.string().nullable(),
  orden: z.number().int(),
});
const contratoEvento = z.object({
  id: z.number().int(),
  institucion: contratoInstitucion,
  fecha: z.string(),
  lugar: z.string().nullable(),
  numero_ceremonias: z.number().int(),
  ceremonias: z.array(contratoCeremonia).optional(),
});
const contratoListado = z.object({
  data: z.array(contratoEvento),
  links: z.object({ next: z.string().nullable() }),
});
const contratoProgramacionInstitucional = contratoListado.extend({
  data: z.array(contratoEvento.extend({
    sede: z.object({ id: z.number().int(), nombre: z.string() }).nullable(),
    ceremonias: z.array(contratoCeremonia),
  })),
});

export type InstitucionEnsayo = z.infer<typeof contratoInstitucion>;
export type CeremoniaEnsayo = z.infer<typeof contratoCeremonia>;
export type AltaEvento = {
  institucion_id: number;
  fecha: string;
  lugar: string | null;
  numero_ceremonias: number;
  operation_id: string;
};

// * Conserva la forma que ya pinta GestionEventos para reutilizar sus tarjetas.
function adaptarEvento({ id, institucion, fecha, lugar, numero_ceremonias }: z.infer<typeof contratoEvento>) {
  return { id, fecha, lugar, numero_ceremonias, nombre_institucion: institucion.nombre, tipo_institucion: institucion.tipo };
}
export type EventoEnsayo = ReturnType<typeof adaptarEvento>;

export const camposAlta = {
  'evento.institucion_id': 'institucion',
  'evento.fecha': 'fecha',
  'evento.lugar': 'lugar',
  'evento.numero_ceremonias': 'numCer',
} as const;

async function leer<T>(respuesta: Response, contrato: z.ZodType<T>): Promise<T> {
  const resultado = contrato.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success) throw new ErrorSesion(0);
  return resultado.data;
}

export async function consultarInstituciones(signal: AbortSignal): Promise<InstitucionEnsayo[]> {
  const respuesta = await solicitar('/api/instituciones', signal);
  return (await leer(respuesta, z.object({ data: z.array(contratoInstitucion) }))).data;
}

export async function consultarEventos(pagina: number, signal: AbortSignal) {
  const { data, links } = await leer(await solicitar(`/api/eventos?page=${pagina}`, signal), contratoListado);
  return { eventos: data.map(adaptarEvento), hayMas: links.next !== null };
}

export async function consultarProgramacionInstitucional(vinculoId: number, pagina: number, signal: AbortSignal) {
  const ruta = `/api/mi-institucion/vinculos/${vinculoId}/eventos?page=${pagina}`;
  const { data, links } = await leer(await solicitar(ruta, signal), contratoProgramacionInstitucional);
  return { eventos: data, hayMas: links.next !== null };
}

export async function consultarCeremonias(eventoId: number, signal: AbortSignal): Promise<CeremoniaEnsayo[]> {
  const respuesta = await solicitar(`/api/eventos/${eventoId}/ceremonias`, signal);
  return (await leer(respuesta, z.object({ data: z.array(contratoCeremonia) }))).data;
}

/** Reenviar el mismo `operation_id` y contenido devuelve el evento original sin crear otro. */
export async function crearEvento(datos: AltaEvento) {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  const respuesta = await solicitar('/api/eventos', signal, datos, [...Object.keys(camposAlta), 'evento']);
  const { data } = await leer(respuesta, z.object({ data: contratoEvento }));
  return { evento: adaptarEvento(data), ceremonias: data.ceremonias ?? [] };
}

export function mensajeEventos(error: unknown): string {
  if (error instanceof ErrorSesion) {
    switch (error.estado) {
      case 403: return 'Tu cuenta no tiene acceso al ensayo de eventos en Laravel.';
      case 404: return 'El evento ya no está disponible. Actualiza la lista.';
      case 409: return 'Este intento ya se registró con otros datos. Revisa la lista antes de crear otro evento.';
      case 422: return 'Revisa los campos marcados.';
      case 401: case 419: case 429: case 0: return mensajeSesion(error);
    }
  }
  return 'El servicio no pudo completar la solicitud. Puedes reintentar sin duplicar el evento.';
}
