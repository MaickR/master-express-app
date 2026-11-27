import type { ComponentType, HTMLAttributes } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/shared/ui/badge';
import { buttonVariants } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';

type PropsBloque = ComponentType<HTMLAttributes<HTMLDivElement>>;
const Tarjeta = Card as PropsBloque;
const Encabezado = CardHeader as PropsBloque;
const Titulo = CardTitle as PropsBloque;
const Contenido = CardContent as PropsBloque;
const Insignia = Badge as ComponentType<HTMLAttributes<HTMLDivElement> & { variant: 'outline' }>;

export function CorreoVerificado() {
  return (
    <Insignia variant="outline" className="gap-1.5 border-exito/30 bg-exito-suave text-exito">
      <BadgeCheck aria-hidden="true" className="size-4 shrink-0" /> Correo verificado
    </Insignia>
  );
}

export default function DatosCuentaPortal({ nombre, correo, verificado }: {
  nombre: string;
  correo: string;
  verificado: boolean | null;
}) {
  return (
    <Tarjeta className="max-w-2xl shadow-none [overflow-wrap:anywhere]">
      <Encabezado className="p-4 sm:p-5">
        <Titulo><h2 className="text-lg leading-snug">Datos de tu cuenta</h2></Titulo>
      </Encabezado>
      <Contenido className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Nombre</dt>
            <dd className="mt-1 font-medium">{nombre.trim() || 'Sin registrar'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Correo electrónico</dt>
            <dd className="mt-1 font-medium">{correo.trim() || 'Sin registrar'}</dd>
          </div>
          {verificado !== null && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Verificación</dt>
              <dd className="mt-1.5">{verificado ? <CorreoVerificado /> : 'Verificación sin confirmar'}</dd>
            </div>
          )}
        </dl>
        <Separator />
        <Link to="/recuperar-contrasena" className={buttonVariants({
          variant: 'outline',
          className: 'min-h-11 h-auto whitespace-normal shadow-none motion-reduce:transition-none',
        })}>
          Recuperar contraseña
        </Link>
      </Contenido>
    </Tarjeta>
  );
}
