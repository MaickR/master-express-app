import { z } from 'zod';
import { solicitar, ErrorSesion } from '@/features/acceso/cliente-sesion';

const perfil = z.object({ data: z.object({
  nombre: z.string(), correo: z.string(), roles: z.array(z.string()), activa: z.boolean(),
  principal: z.boolean(), correo_verificado: z.boolean(),
}) });
const auditoria = z.object({ data: z.array(z.object({
  id: z.number(), actor_id: z.number(), cuenta_id: z.number(), accion: z.string(), created_at: z.string(),
})), hayMas: z.boolean() });

export async function consultarPerfil(signal: AbortSignal) {
  const respuesta = await solicitar('/api/mi-perfil', signal);
  const datos = perfil.safeParse(await respuesta.json());
  if (!datos.success) throw new ErrorSesion(0);
  return datos.data.data;
}

export async function cambiarPersonal(ruta: string, datos: object, campos: string[] = []) {
  const signal = AbortSignal.timeout(15000);
  await solicitar('/sanctum/csrf-cookie', signal);
  return solicitar(ruta, signal, datos, campos);
}

export async function consultarAuditoria(pagina: number, signal: AbortSignal) {
  const respuesta = await solicitar(`/api/administracion/cuentas/auditoria?page=${pagina}`, signal);
  const datos = auditoria.safeParse(await respuesta.json());
  if (!datos.success) throw new ErrorSesion(0);
  return datos.data;
}

export const rolesPersonal = [
  ['administrador', 'Administrador'], ['colaborador', 'Colaborador'], ['vendedor', 'Vendedor'],
  ['finanzas', 'Finanzas'], ['inventario', 'Inventario'],
] as const;

export function errorPersonal(error: unknown): string {
  if (error instanceof ErrorSesion) {
    if (error.estado === 409 && error.aviso) return error.aviso;
    if (error.estado === 403) return 'No tienes permiso para esta operación. La cuenta principal está protegida.';
    if (error.estado === 422) return 'Revisa los campos indicados. El correo debe ser único y la contraseña debe cumplir los requisitos.';
    if (error.estado === 429) return 'Hay demasiadas solicitudes. Espera un momento y vuelve a intentar.';
  }
  return 'No se pudo completar la operación. Revisa la conexión o vuelve a ingresar.';
}

export function leerFormulario(formulario: HTMLFormElement): Record<string, string> {
  const datos: Record<string, string> = {};
  new FormData(formulario).forEach((valor, campo) => { if (typeof valor === 'string') datos[campo] = valor; });
  return datos;
}
