import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ComponentType, type HTMLAttributes } from 'react';
import { ArrowRight, CircleUserRound, GraduationCap, House } from 'lucide-react';
import PanelOperativo from '@/shared/components/PanelOperativo';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import type { Identidad } from './cliente-sesion';
import GestionGraduandos from '@/features/graduandos/gestion-graduandos';
import DatosCuentaPortal, { CorreoVerificado } from './datos-cuenta-portal';

type PropsBloque = ComponentType<HTMLAttributes<HTMLDivElement>>;
const Tarjeta = Card as PropsBloque;
const Encabezado = CardHeader as PropsBloque;
const Titulo = CardTitle as PropsBloque;
const Contenido = CardContent as PropsBloque;
const BotonPerfil = Button as ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { variant: 'outline' }>;

const grupos = [{
  id: 'portal',
  destinos: [
    { id: 'inicio', label: 'Inicio', icon: House },
    { id: 'perfil', label: 'Mi perfil', icon: CircleUserRound },
  ],
}];

export default function PortalGraduando({ identidad }: { identidad: Identidad }) {
  const [seccion, elegirSeccion] = useState('inicio');
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [seccion]);

  const inicio = seccion === 'inicio';
  const nombre = identidad.nombre.trim();
  // * Laravel incluye graduando en la sesión de una cuenta activa con correo verificado.
  const verificado = identidad.roles.includes('graduando');

  return (
    <PanelOperativo grupos={grupos} activo={seccion} rol="Graduando" nombre={identidad.nombre}
      alSeleccionar={elegirSeccion} alAbrirPerfil={() => elegirSeccion('perfil')}>
      <div className="panel-pagina max-w-4xl space-y-6">
        <header className={inicio ? 'panel-portada' : 'portal-encabezado'}>
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h1 ref={titulo} tabIndex={-1}>
              {inicio ? (nombre ? `Hola, ${nombre}` : 'Portal de Graduandos') : 'Mi perfil'}
            </h1>
            {inicio && <p>Consulta el estado de tu cuenta y tus datos de perfil.</p>}
          </div>
        </header>
        {inicio ? (
          <section aria-labelledby="titulo-ceremonias" className="space-y-4">
            <GestionGraduandos actorId={identidad.id} lectura />
            <Tarjeta className="shadow-none">
              <Encabezado className="flex-row items-start gap-3 space-y-0 p-4 sm:p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-suave text-primary-suave-foreground">
                  <GraduationCap aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
                  <Titulo><h2 id="titulo-ceremonias" className="text-lg leading-snug">Vinculación con una ceremonia</h2></Titulo>
                  {verificado && <CorreoVerificado />}
                </div>
              </Encabezado>
              <Contenido className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {verificado ? 'Tu cuenta está creada y verificada.' : 'Tu cuenta está creada.'}{' '}
                  La vinculación con una ceremonia requiere confirmación de MasterExpress.
                </p>
                <Separator />
                <BotonPerfil type="button" variant="outline"
                  className="min-h-11 h-auto whitespace-normal shadow-none motion-reduce:transition-none"
                  onClick={() => elegirSeccion('perfil')}>
                  Ver mi perfil <ArrowRight aria-hidden="true" />
                </BotonPerfil>
              </Contenido>
            </Tarjeta>
          </section>
        ) : (
          <DatosCuentaPortal nombre={identidad.nombre} correo={identidad.correo} verificado={verificado || null} />
        )}
      </div>
    </PanelOperativo>
  );
}
