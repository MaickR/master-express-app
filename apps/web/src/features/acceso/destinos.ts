import type { RolInterno } from './cliente-sesion';

export const paneles = {
  administrador: { ruta: '/AdminDashboard', nombre: 'Administrador' },
  colaborador: { ruta: '/ColaboradorDashboard', nombre: 'Colaborador' },
} satisfies Record<RolInterno, { ruta: string; nombre: string }>;
