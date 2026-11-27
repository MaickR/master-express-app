import { createElement, type ComponentType } from 'react';
import type { Identidad, RolDeSesion } from '@/features/acceso/cliente-sesion';
import { paneles } from '@/features/acceso/destinos';
import PortalGraduando from '@/features/acceso/portal-graduando';
import AdminDashboard from '@/features/paneles/AdminDashboard';
import ColaboradorDashboard from '@/features/paneles/ColaboradorDashboard';
import RegistroGraduando from '@/features/graduandos/RegistroGraduando';
import Layout from './Layout';

type PropsPantalla = { identidad: Identidad };

export const paginasPrivadas: Array<{ ruta: string; rol: RolDeSesion; Pantalla: ComponentType<PropsPantalla> }> = [
  { ruta: paneles.administrador.ruta, rol: 'administrador', Pantalla: AdminDashboard },
  {
    ruta: paneles.colaborador.ruta, rol: 'colaborador',
    Pantalla: ({ identidad }) => createElement(Layout, { identidad, Pantalla: ColaboradorDashboard }),
  },
  {
    ruta: '/RegistroGraduando', rol: 'colaborador',
    Pantalla: ({ identidad }) => createElement(Layout, { identidad, Pantalla: RegistroGraduando }),
  },
  { ruta: paneles.graduando.ruta, rol: 'graduando', Pantalla: PortalGraduando },
];
