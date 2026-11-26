import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';

const Alerta = Alert as ComponentType<ComponentProps<'div'>>;
const Descripcion = AlertDescription as ComponentType<ComponentProps<'div'>>;

export default function AvisoAcceso({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Alerta id={id} className="border-destructive/40 bg-error-suave text-error [&>svg]:text-error">
      <CircleAlert aria-hidden="true" className="size-4" />
      <Descripcion>{children}</Descripcion>
    </Alerta>
  );
}
