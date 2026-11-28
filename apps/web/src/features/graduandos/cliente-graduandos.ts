import { z } from 'zod';
import { solicitar, ErrorSesion, mensajeSesion } from '@/features/acceso/cliente-sesion';

const perfil = z.object({ id: z.number().int(), nombre_completo: z.string(), tipo_documento: z.string().nullable(),
  numero_documento: z.string().nullable(), correo: z.string().nullable(), telefono: z.string().nullable(),
  revision: z.number().int(), puede_editar: z.boolean(), vinculado: z.boolean() });
export type PerfilGraduando = z.infer<typeof perfil>;
export type DatosGraduando = { nombre_completo: string; tipo_documento: string; numero_documento: string; correo: string; telefono: string };
const inscripcion = z.object({ id: z.number().int(), evento_id: z.number().int(), ceremonia_id: z.number().int(),
  programa_academico: z.string().nullable(), creado_en: z.string().optional() }).passthrough();
async function leer<T>(respuesta: Response, contrato: z.ZodType<T>) {
  const resultado = contrato.safeParse(await respuesta.json().catch(() => null));
  if (!resultado.success) throw new ErrorSesion(0);
  return resultado.data;
}
export function listarGraduandos(pagina: number, filtros: Record<string, string>, signal: AbortSignal) {
  const parametros = new URLSearchParams({ page: String(pagina) });
  for (const [campo, valor] of Object.entries(filtros)) if (valor.trim()) parametros.set(campo, valor.trim());
  return solicitar('/api/graduandos?' + parametros, signal).then(respuesta => leer(respuesta,
    z.object({ data: z.array(perfil), hayMas: z.boolean(), total: z.number().int() })));
}
export function consultarGraduando(id: number, signal: AbortSignal) {
  return solicitar('/api/graduandos/' + id, signal).then(respuesta => leer(respuesta, z.object({ data: perfil })));
}
export async function guardarGraduando(datos: DatosGraduando, operacion: string, previo: PerfilGraduando | null) {
  if (!navigator.onLine) throw new ErrorSesion(0);
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  const cuerpo = { ...datos, ...(previo ? { revision: previo.revision } : { operation_id: operacion }) };
  return leer(await solicitar('/api/graduandos' + (previo ? '/' + previo.id : ''), signal, cuerpo,
    Object.keys(datos).map(campo => 'graduando.' + campo)), z.object({ data: perfil }));
}
export function listarInscripciones(id: number, pagina: number, signal: AbortSignal) {
  return solicitar(`/api/registros?graduando_id=${id}&page=${pagina}`, signal).then(respuesta => leer(respuesta,
    z.object({ data: z.array(inscripcion), links: z.object({ next: z.string().nullable() }) })));
}
export function listarProgramacion(pagina: number, signal: AbortSignal) {
  return solicitar('/api/graduandos/programacion?page=' + pagina, signal).then(respuesta => leer(respuesta,
    z.object({ data: z.array(z.object({ id: z.number().int(), nombre: z.string(),
      ceremonias: z.array(z.object({ id: z.number().int(), nombre: z.string() })) })), hayMas: z.boolean() })));
}
export async function inscribirGraduando(id: number, evento: number, ceremonia: number, programa: string, operacion: string) {
  if (!navigator.onLine) throw new ErrorSesion(0);
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  return leer(await solicitar(`/api/ceremonias/${ceremonia}/registros`, signal, {
    graduando_id: id, evento_id: evento, programa_academico: programa || null, operation_id: operacion,
  }), z.object({ data: inscripcion }));
}
export function mensajeGraduandos(error: unknown) {
  if (error instanceof ErrorSesion) {
    if (error.estado === 409) return error.aviso || 'Los datos cambiaron o ya existe ese registro. Actualiza y revisa antes de continuar.';
    if (error.estado === 422) return 'Revisa los campos del formulario. No se guardaron cambios.';
    if (error.estado === 404) return 'El registro ya no está disponible en tu ámbito. Actualiza la lista.';
    if (error.estado === 403) return 'Esta consulta todavía no está disponible para tu cuenta.';
  }
  return mensajeSesion(error);
}

export function listarFiltrosGraduandos(signal: AbortSignal) {
  const opcion = z.object({ id: z.number().int(), nombre: z.string() });
  return solicitar('/api/graduandos/filtros', signal).then(respuesta => leer(respuesta,
    z.object({ data: z.array(opcion.extend({ institucion: opcion, sede: opcion.nullable(), ceremonias: z.array(opcion) })) })));
}
