import { forwardRef, useState, type ComponentProps, type ComponentType } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import Button from './BotonAcceso';

const Campo = Input as ComponentType<ComponentProps<'input'>>;

type Props = Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  id: string;
  etiqueta: string;
};

const CampoContrasena = forwardRef<HTMLInputElement, Props>(function CampoContrasena(
  { etiqueta, ...props }, ref,
) {
  const [visible, establecerVisible] = useState(false);
  const Icono = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Campo {...props} ref={ref} type={visible ? 'text' : 'password'}
        className="acceso__campo h-12 pl-3.5 pr-14 md:text-base sm:h-[3.25rem]" />
      <Button type="button" variant="ghost" size="icon" disabled={props.disabled}
        className="absolute right-0.5 top-1/2 size-11 -translate-y-1/2 text-muted-foreground [&_svg]:size-5"
        aria-controls={props.id} aria-label={(visible ? 'Ocultar ' : 'Mostrar ') + etiqueta}
        onClick={() => establecerVisible(!visible)}>
        <Icono aria-hidden="true" />
      </Button>
    </div>
  );
});

export default CampoContrasena;
