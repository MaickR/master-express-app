import { useRef, useState, type ComponentType, type HTMLAttributes } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, CircleAlert } from "lucide-react";
import { consultarProgramacionInstitucional } from "@/features/ceremonias/cliente-eventos";
import DatosEvento from "@/features/ceremonias/datos-evento";
import { buttonVariants } from "@/shared/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorSesion, mensajeSesion, type AmbitoInstitucional } from "./cliente-sesion";

const boton = buttonVariants({
  variant: "outline", className: "min-h-11 h-auto whitespace-normal shadow-none motion-reduce:transition-none",
});
const TarjetaEvento = Card as ComponentType<HTMLAttributes<HTMLDivElement>>;
const ContenidoEvento = CardContent as ComponentType<HTMLAttributes<HTMLDivElement>>;
const EncabezadoEvento = CardHeader as ComponentType<HTMLAttributes<HTMLDivElement>>;

export function ErrorProgramacion({ error, reintentar, mensajeGeneral = "No pudimos consultar la programación. Vuelve a intentar." }: {
  error: unknown;
  reintentar: () => void;
  mensajeGeneral?: string;
}) {
  let mensaje = mensajeGeneral;
  if (error instanceof ErrorSesion) {
    if (error.estado === 403) mensaje = "Tu cuenta no tiene acceso a este ámbito institucional.";
    if ([0, 401, 429].includes(error.estado)) mensaje = mensajeSesion(error);
  }

  return (
    <TarjetaEvento className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-none">
      <div className="flex min-w-0 items-start gap-2 text-error">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p role="alert" className="text-sm">{mensaje}</p>
      </div>
      <button type="button" className={boton} onClick={reintentar}>Reintentar</button>
    </TarjetaEvento>
  );
}

export default function ProgramacionInstitucional({ ambito, usuarioId, actualizarAmbitos }: {
  ambito: AmbitoInstitucional;
  usuarioId: number;
  actualizarAmbitos: () => void;
}) {
  const [pagina, cambiarPagina] = useState(1);
  const titulo = useRef<HTMLHeadingElement>(null);
  const consulta = useQuery({
    queryKey: ["programacion-institucional", usuarioId, ambito.vinculo_id, pagina],
    queryFn: ({ signal }) => consultarProgramacionInstitucional(ambito.vinculo_id, pagina, signal),
    retry: false,
    gcTime: 0,
  });

  function irAPagina(nuevaPagina: number) {
    titulo.current?.focus();
    cambiarPagina(nuevaPagina);
  }

  return (
    <section className="space-y-4" aria-labelledby="ambito-programacion">
      <div className="space-y-1 [overflow-wrap:anywhere]">
        <h2 id="ambito-programacion" ref={titulo} tabIndex={-1} className="text-lg font-semibold leading-snug">{ambito.nombre}</h2>
        {ambito.sede && <p className="text-sm text-muted-foreground">{ambito.sede.nombre}</p>}
      </div>
      {consulta.isFetching && (
        <div role="status" className="space-y-3">
          <p className="text-sm text-muted-foreground">Cargando eventos…</p>
          <TarjetaEvento className="space-y-3 p-4 shadow-none sm:p-5" aria-hidden="true">
            <Skeleton className="h-5 w-1/2 max-w-64 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-1/3 max-w-40 motion-reduce:animate-none" />
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
          </TarjetaEvento>
        </div>
      )}
      {!consulta.isFetching && consulta.isError && (
        <ErrorProgramacion error={consulta.error} reintentar={() => {
          titulo.current?.focus();
          if (consulta.error instanceof ErrorSesion && consulta.error.estado === 403) actualizarAmbitos();
          void consulta.refetch();
        }} />
      )}
      {!consulta.isFetching && consulta.isSuccess && (
        <>
          {consulta.data.eventos.length === 0 && (
            <TarjetaEvento className="flex items-start gap-3 p-4 shadow-none sm:p-5" role="status">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <CalendarDays aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">No hay eventos programados</p>
                <p className="mt-1 text-sm text-muted-foreground">Aquí aparecerán los próximos eventos de esta sede.</p>
              </div>
            </TarjetaEvento>
          )}
          {consulta.data.eventos.length > 0 && <div className="grid gap-3">
            {consulta.data.eventos.map(evento => (
              <TarjetaEvento key={evento.id} className="min-w-0 shadow-none [overflow-wrap:anywhere]">
                <EncabezadoEvento className="flex-row items-start gap-3 space-y-0 p-4 sm:px-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-suave text-primary-suave-foreground">
                    <CalendarDays aria-hidden="true" className="size-5" />
                  </span>
                  <DatosEvento fecha={evento.fecha} lugar={evento.lugar} destacarFecha />
                </EncabezadoEvento>
                <ContenidoEvento className="px-4 pb-2 sm:px-5">
                  <details className="group border-t border-border">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                      <span>Ceremonias ({evento.numero_ceremonias})</span>
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" />
                    </summary>
                    {evento.ceremonias.length === 0 ? (
                      <p className="px-2 pb-3 pt-1 text-sm text-muted-foreground">No hay ceremonias programadas.</p>
                    ) : (
                      <ol className="divide-y divide-border border-t border-border px-2 text-sm">
                        {evento.ceremonias.map(ceremonia => (
                          <li key={ceremonia.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                            <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">Orden {ceremonia.orden}</span>
                            <span className="font-medium">{ceremonia.nombre}</span>
                            {ceremonia.hora && (
                              <time className="col-start-2 text-muted-foreground tabular-nums sm:col-start-auto" dateTime={ceremonia.hora}>
                                {ceremonia.hora.slice(0, 5)}
                              </time>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </details>
                </ContenidoEvento>
              </TarjetaEvento>
            ))}
          </div>}
          {(pagina > 1 || consulta.data.hayMas) && (
            <nav aria-label="Páginas de eventos" className="flex flex-wrap items-center gap-3">
              <button type="button" className={boton} disabled={pagina === 1}
                onClick={() => irAPagina(pagina - 1)}>Anterior</button>
              <span>Página {pagina}</span>
              <button type="button" className={boton} disabled={!consulta.data.hayMas}
                onClick={() => irAPagina(pagina + 1)}>Siguiente</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
