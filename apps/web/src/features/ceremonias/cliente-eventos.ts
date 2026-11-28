import { z } from 'zod';
import { ErrorSesion, mensajeSesion, solicitar } from '@/features/acceso/cliente-sesion';

const contratoInstitucion = z.object({ id: z.number().int(), nombre: z.string(), tipo: z.string() });
const contratoSede = z.object({ id: z.number().int(), nombre: z.string() });
const contratoCatalogo = contratoInstitucion.extend({ sedes: z.array(contratoSede) });
const contratoCeremonia = z.object({
  id: z.number().int(),
  evento_id: z.number().int(),
  nombre: z.string(),
  hora: z.string().nullable(),
  orden: z.number().int(),
  graduandos_vinculados: z.number().int().optional(),
  programas: z.array(z.string()).optional(),
});
const contratoEvento = z.object({
  id: z.number().int(),
  institucion: contratoInstitucion,
  sede: contratoSede.nullable(),
  fecha: z.string(),
  estado: z.enum(['proximo', 'en_ejecucion', 'finalizado', 'cancelado']),
  lugar: z.string().nullable(),
  numero_ceremonias: z.number().int(),
});
const contratoListado = z.object({
  data: z.array(contratoEvento),
  links: z.object({ next: z.string().nullable() }),
});
const contratoEventoConCeremonias = contratoEvento.extend({ ceremonias: z.array(contratoCeremonia) });
const contratoProgramacionInstitucional = contratoListado.extend({ data: z.array(contratoEventoConCeremonias) });
const contratoDetalle = contratoEventoConCeremonias.extend({
  revision: z.number().int(),
  graduandos_previstos: z.number().int().nullable(),
  responsable: z.string().nullable(),
  observaciones: z.string().nullable(),
  cancelado_en: z.string().nullable(),
});
const contratoListaOperativa = contratoListado.extend({
  meta: z.object({ total: z.number().int() }),
  fecha_operativa: z.string(),
});

export const camposAlta = {
  'evento.institucion_id': 'institucion',
  'evento.sede_id': 'sede',
  'evento.fecha': 'fecha',
  'evento.lugar': 'lugar',
  'evento.numero_ceremonias': 'numCer',
} as const;

export type AltaEvento = {
  institucion_id: number;
  sede_id: number;
  fecha: string;
  lugar: string | null;
  numero_ceremonias: number;
  operation_id: string;
};

async function leer<T>(respuesta: Response, contrato: z.ZodType<T>): Promise<T> {
  const resultado = contrato.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success) throw new ErrorSesion(0);
  return resultado.data;
}

export async function consultarInstituciones(signal: AbortSignal) {
  const respuesta = await solicitar('/api/instituciones', signal);
  return (await leer(respuesta, z.object({ data: z.array(contratoCatalogo) }))).data;
}

export async function consultarEventos(pagina: number, signal: AbortSignal, filtros: Record<string, string>) {
  const parametros = new URLSearchParams({ page: String(pagina) });
  for (const [clave, valor] of Object.entries(filtros)) if (valor.trim()) parametros.set(clave, valor.trim());
  const { data, links, meta, fecha_operativa } = await leer(
    await solicitar('/api/eventos?' + parametros, signal), contratoListaOperativa,
  );
  return { eventos: data, hayMas: links.next !== null, total: meta.total, fechaOperativa: fecha_operativa };
}

export async function consultarProgramacionInstitucional(vinculoId: number, pagina: number, signal: AbortSignal) {
  const ruta = `/api/mi-institucion/vinculos/${vinculoId}/eventos?page=${pagina}`;
  const { data, links } = await leer(await solicitar(ruta, signal), contratoProgramacionInstitucional);
  return { eventos: data, hayMas: links.next !== null };
}

export async function consultarEvento(eventoId: number, signal: AbortSignal) {
  const respuesta = await solicitar(`/api/eventos/${eventoId}`, signal);
  return (await leer(respuesta, z.object({ data: contratoDetalle }))).data;
}

async function guardar(ruta: string, datos: object, campos: readonly string[] = []) {
  if (!navigator.onLine) throw new ErrorSesion(0);
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  const respuesta = await solicitar(ruta, signal, datos, campos);
  return (await leer(respuesta, z.object({ data: contratoDetalle }))).data;
}

/** El mismo identificador y contenido permite recuperar un alta confirmada. */
export function crearEvento(datos: AltaEvento) {
  return guardar('/api/eventos', datos, Object.keys(camposAlta));
}

export function actualizarEvento(id: number, datos: object) {
  return guardar(`/api/eventos/${id}`, datos);
}

export function cancelarEvento(id: number) {
  return guardar(`/api/eventos/${id}/cancelacion`, {});
}

export function mensajeEventos(error: unknown): string {
  if (error instanceof ErrorSesion) {
    switch (error.estado) {
      case 403: return 'Tu cuenta no tiene acceso a la programación de eventos.';
      case 404: return 'El evento ya no está disponible. Actualiza la lista.';
      case 409: return error.aviso || 'La programación cambió. Actualiza la lista y vuelve a intentar.';
      case 422: return 'Revisa los datos del evento e intenta de nuevo.';
      case 503: return 'La programación de eventos todavía no está disponible.';
      case 401: case 419: case 429: case 0: return mensajeSesion(error);
    }
  }
  return 'No se pudo completar la solicitud. Vuelve a intentar.';
}
