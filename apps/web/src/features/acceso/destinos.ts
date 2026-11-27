import type { RolDeSesion } from './cliente-sesion';

export const paneles = {
  administrador: { ruta: '/AdminDashboard', nombre: 'Administrador' },
  colaborador: { ruta: '/ColaboradorDashboard', nombre: 'Colaborador' },
  graduando: { ruta: '/portal/graduando', nombre: 'Graduando' },
  institucion: { ruta: '/portal/institucion', nombre: 'Institución' },
} satisfies Record<RolDeSesion, { ruta: string; nombre: string }>;
