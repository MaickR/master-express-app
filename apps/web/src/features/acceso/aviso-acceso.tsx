import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { ErrorSesion } from './cliente-sesion';

const Alerta = Alert as ComponentType<ComponentProps<'div'>>;
const Descripcion = AlertDescription as ComponentType<ComponentProps<'div'>>;

const tonos = {
  error: { Icono: CircleAlert, rol: 'alert' },
  advertencia: { Icono: TriangleAlert, rol: 'alert' },
  informacion: { Icono: Info, rol: 'status' },
  confirmacion: { Icono: CircleCheck, rol: 'status' },
} as const;

export type TonoAcceso = keyof typeof tonos;

export function tonoFalloAcceso(fallo: unknown): TonoAcceso {
  return fallo instanceof ErrorSesion && [0, 409, 419, 429].includes(fallo.estado) ? 'advertencia' : 'error';
}

export default function AvisoAcceso({ id, tono = 'error', children }: {
  id?: string;
  tono?: TonoAcceso;
  children: ReactNode;
}) {
  const { Icono, rol } = tonos[tono];

  return (
    <Alerta id={id} role={rol} data-tono={tono} className="acceso__aviso">
      <Icono aria-hidden="true" className="size-4" />
      <Descripcion>{children}</Descripcion>
    </Alerta>
  );
}
