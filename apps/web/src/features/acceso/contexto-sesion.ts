import { createContext, useContext } from 'react';
import type { Credenciales, Identidad } from './cliente-sesion';

export type EstadoSesion =
  | { tipo: 'comprobando' }
  | { tipo: 'autenticado'; identidad: Identidad }
  | { tipo: 'anonimo'; aviso?: string }
  | { tipo: 'error'; mensaje: string };

export const ContextoSesion = createContext<{
  estado: EstadoSesion;
  iniciar: (datos: Credenciales) => Promise<void>;
  cerrar: () => Promise<void>;
  comprobar: () => void;
} | null>(null);

export function useSesion() {
  const contexto = useContext(ContextoSesion);
  if (!contexto) throw new Error('El contexto de sesión es obligatorio.');
  return contexto;
}
