import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, CircleUserRound, GraduationCap, House, MailCheck } from 'lucide-react';
import PanelOperativo from '@/shared/components/PanelOperativo';
import type { Identidad } from './cliente-sesion';

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

  const verificado = (
    <span className="inline-flex max-w-full items-center gap-2 text-sm font-semibold text-exito">
      <BadgeCheck aria-hidden="true" className="size-5 shrink-0" /> Correo verificado
    </span>
  );

  return (
    <PanelOperativo grupos={grupos} activo={seccion} rol="Graduando" nombre={identidad.nombre}
      alSeleccionar={elegirSeccion} alAbrirPerfil={() => elegirSeccion('perfil')}>
      <div className="panel-pagina max-w-5xl">
        <header className="rounded-2xl border border-border border-t-4 border-t-primary bg-card p-5 text-card-foreground sm:p-8">
          <h1 ref={titulo} tabIndex={-1} className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
            {seccion === 'inicio' ? 'Portal de Graduandos' : 'Mi perfil'}
          </h1>
          {seccion === 'inicio' && (
            <p className="mt-3 text-base text-muted-foreground [overflow-wrap:anywhere]">Bienvenido, {identidad.nombre}.</p>
          )}
          <div className="mt-4">{verificado}</div>
        </header>
        {seccion === 'inicio' ? (
          <section aria-labelledby="titulo-ceremonias" className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <GraduationCap aria-hidden="true" className="mb-3 size-6 text-interactivo" />
            <h2 id="titulo-ceremonias" className="text-lg font-semibold">Vinculación a ceremonias</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
              Crear tu cuenta y verificar el correo son los primeros pasos. La vinculación con una ceremonia requiere una autorización aparte.
            </p>
          </section>
        ) : (
          <section aria-labelledby="datos-perfil" className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <MailCheck aria-hidden="true" className="mb-3 size-6 text-interactivo" />
            <h2 id="datos-perfil" className="text-lg font-semibold">Datos de tu cuenta</h2>
            <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-sm font-semibold">Nombre</dt>
                <dd className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{identidad.nombre}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm font-semibold">Correo electrónico</dt>
                <dd className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{identidad.correo}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </PanelOperativo>
  );
}
