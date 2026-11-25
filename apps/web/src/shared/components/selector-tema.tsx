import type { ComponentProps, ComponentType } from 'react';
import type * as Radix from '@radix-ui/react-dropdown-menu';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { buttonVariants } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

const Menu = DropdownMenuContent as ComponentType<ComponentProps<typeof Radix.Content>>;
const Opcion = DropdownMenuRadioItem as ComponentType<ComponentProps<typeof Radix.RadioItem>>;
const modos = {
  light: { etiqueta: 'Claro', Icono: Sun },
  dark: { etiqueta: 'Oscuro', Icono: Moon },
  system: { etiqueta: 'Sistema', Icono: Monitor },
};

export default function SelectorTema({ className, mostrarEtiqueta }: { className?: string; mostrarEtiqueta?: boolean }) {
  const { theme, setTheme } = useTheme();
  const modo = theme === 'light' || theme === 'dark' ? theme : 'system';
  const { etiqueta, Icono } = modos[modo];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tema visual: ${etiqueta}`}
        title={`Tema visual: ${etiqueta}`}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-11 shrink-0',
          mostrarEtiqueta && 'sm:w-auto sm:px-3', className)}>
        <Icono aria-hidden="true" />
        {mostrarEtiqueta && <span className="hidden sm:inline">{etiqueta}</span>}
      </DropdownMenuTrigger>
      <Menu align="end" sideOffset={6} collisionPadding={8} aria-label="Tema visual" className="min-w-40">
        <DropdownMenuRadioGroup value={modo} onValueChange={setTheme}>
          {Object.entries(modos).map(([valor, { etiqueta: nombre, Icono: IconoModo }]) => (
            <Opcion key={valor} value={valor} className="min-h-11 gap-2 data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-ring">
              <IconoModo aria-hidden="true" className="size-4" />
              {nombre}
            </Opcion>
          ))}
        </DropdownMenuRadioGroup>
      </Menu>
    </DropdownMenu>
  );
}
