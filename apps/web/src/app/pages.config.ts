import { createElement, type ComponentType } from 'react';
import type { Identidad, RolInterno } from '@/features/acceso/cliente-sesion';
import { paneles } from '@/features/acceso/destinos';
import AdminDashboard from '@/features/paneles/AdminDashboard';
import ColaboradorDashboard from '@/features/paneles/ColaboradorDashboard';
import RegistroGraduando from '@/features/graduandos/RegistroGraduando';
import Layout from './Layout';

type PropsPantalla = { identidad: Identidad };

export const paginasPrivadas: Array<{ ruta: string; rol: RolInterno; Pantalla: ComponentType<PropsPantalla> }> = [
  { ruta: paneles.administrador.ruta, rol: 'administrador', Pantalla: AdminDashboard },
  {
    ruta: paneles.colaborador.ruta, rol: 'colaborador',
    Pantalla: ({ identidad }) => createElement(Layout, { identidad, Pantalla: ColaboradorDashboard }),
  },
  {
    ruta: '/RegistroGraduando', rol: 'colaborador',
    Pantalla: ({ identidad }) => createElement(Layout, { identidad, Pantalla: RegistroGraduando }),
  },
];
