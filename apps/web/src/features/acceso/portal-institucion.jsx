import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarDays, GraduationCap, House, UserRound } from "lucide-react";
import PanelOperativo from "@/shared/components/PanelOperativo";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import { consultarMiInstitucion } from "./cliente-sesion";
import DatosCuentaPortal from "./datos-cuenta-portal";
import ProgramacionInstitucional, { ErrorProgramacion } from "./programacion-institucional";

const secciones = [{
  id: "portal",
  destinos: [
    { id: "inicio", label: "Inicio", icon: House },
    { id: "institucion", label: "Mi institución", icon: Building2 },
    { id: "programacion", label: "Programación", icon: CalendarDays },
    { id: "cuenta", label: "Cuenta", icon: UserRound },
  ],
}];
const tipos = { colegio: "Colegio", universidad: "Universidad" };
const titulos = { inicio: "Inicio", institucion: "Mi institución", programacion: "Programación", cuenta: "Cuenta" };
const reticulaVinculos = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4";
const clasesAccion = "min-h-11 h-auto whitespace-normal shadow-none motion-reduce:transition-none";

/** @param {{ item: import("./cliente-sesion").AmbitoInstitucional, enDetalle: boolean, alVerProgramacion: () => void }} props */
function FichaInstitucion({ item, enDetalle, alVerProgramacion }) {
  const Titulo = enDetalle ? "h2" : "h3";
  const Icono = item.tipo === "universidad" ? GraduationCap : Building2;

  return (
    <Card className="flex min-w-0 flex-col shadow-none [overflow-wrap:anywhere]">
      <CardHeader className="flex-row items-start gap-3 space-y-0 p-4 sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-suave text-primary-suave-foreground">
          <Icono aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 space-y-2">
          <CardTitle><Titulo className="text-base leading-snug">{item.nombre}</Titulo></CardTitle>
          {item.tipo && <Badge variant="outline" className="text-muted-foreground">{tipos[item.tipo] ?? item.tipo}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
        {(item.sede || item.nit) && (
          <>
            <Separator />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {item.sede && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Sede autorizada</dt>
                  <dd className="mt-1 font-medium">{item.sede.nombre}</dd>
                </div>
              )}
              {item.nit && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">NIT</dt>
                  <dd className="mt-1 font-medium tabular-nums">{item.nit}</dd>
                </div>
              )}
            </dl>
          </>
        )}
        <Button type="button" variant="outline" className={`mt-auto self-start ${clasesAccion}`}
          aria-label={`Ver programación de ${item.nombre}${item.sede ? `, sede ${item.sede.nombre}` : ""}`}
          onClick={alVerProgramacion}>
          Ver programación <ArrowRight aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PortalInstitucion({ identidad }) {
  const [seccion, elegirSeccion] = useState("inicio");
  const [vinculoSeleccionado, elegirVinculo] = useState("");
  const titulo = useRef(null);
  const ambito = useQuery({
    queryKey: ["mi-institucion", identidad.id],
    queryFn: ({ signal }) => consultarMiInstitucion(signal),
    retry: false,
  });
  useEffect(() => { titulo.current?.focus(); }, [seccion]);
  const instituciones = ambito.isSuccess ? ambito.data.data : [];
  const seleccionado = instituciones.find(item => String(item.vinculo_id) === vinculoSeleccionado)
    ?? (vinculoSeleccionado === "" && instituciones.length === 1 ? instituciones[0] : undefined);
  const mostrandoFichas = seccion === "inicio" || seccion === "institucion";

  function abrirProgramacion(vinculoId) {
    elegirVinculo(String(vinculoId));
    elegirSeccion("programacion");
  }

  return (
    <PanelOperativo grupos={secciones} activo={seccion} rol="Institución" nombre={identidad.nombre}
      alSeleccionar={elegirSeccion} alAbrirPerfil={() => elegirSeccion("cuenta")}>
      <div className="panel-pagina portal-institucional">
        <header className={seccion === "inicio" ? "panel-portada" : "portal-encabezado"}>
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h1 ref={titulo} tabIndex={-1}>
              {seccion === "inicio" ? `Hola, ${identidad.nombre}` : titulos[seccion]}
            </h1>
            {seccion === "inicio" && <p>Consulta la programación de las instituciones y sedes que representas.</p>}
          </div>
        </header>
        {ambito.isPending && (
          <div role="status" className="space-y-3">
            <p className="text-sm text-muted-foreground">Cargando instituciones…</p>
            <Card className="max-w-xl space-y-3 p-5 shadow-none" aria-hidden="true">
              <Skeleton className="h-5 w-1/2 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-1/3 motion-reduce:animate-none" />
            </Card>
          </div>
        )}
        {!ambito.isFetching && ambito.isError && (
          <ErrorProgramacion error={ambito.error} reintentar={() => void ambito.refetch()}
            mensajeGeneral="No pudimos consultar tus instituciones. Vuelve a intentar." />
        )}
        {ambito.isFetching && !ambito.isPending && !ambito.isSuccess && (
          <p role="status" className="text-sm text-muted-foreground">Consultando instituciones…</p>
        )}
        {mostrandoFichas && instituciones.length > 0 && (
          <section className="space-y-3" aria-label="Instituciones autorizadas">
            {seccion === "inicio" && <h2 className="text-lg font-semibold">Instituciones autorizadas</h2>}
            <div className={`${reticulaVinculos}${instituciones.length === 1 ? " max-w-xl" : ""}`}>
              {instituciones.map(item => (
                <FichaInstitucion key={item.vinculo_id} item={item} enDetalle={seccion === "institucion"}
                  alVerProgramacion={() => abrirProgramacion(item.vinculo_id)} />
              ))}
            </div>
          </section>
        )}
        {seccion === "institucion" && instituciones.length > 0 && (
          <section aria-labelledby="representacion">
            <Card className="shadow-none">
              <CardHeader className="p-4 sm:p-5">
                <CardTitle><h2 id="representacion" className="text-lg leading-snug">Representación institucional</h2></CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                <ul className="divide-y divide-border [overflow-wrap:anywhere]">
                  {instituciones.map(item => (
                    <li key={item.vinculo_id} className="py-3 first:pt-0 last:pb-0">
                      <h3 className="mb-2 text-sm font-semibold">{item.nombre}{item.sede && ` · ${item.sede.nombre}`}</h3>
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        {item.representante && <div><dt className="text-muted-foreground">Representante</dt><dd>{item.representante}</dd></div>}
                        <div><dt className="text-muted-foreground">Correo de la cuenta</dt><dd>{item.correo}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        )}
        {seccion === "programacion" && ambito.isSuccess && (
          <>
            {instituciones.length > 0 && (instituciones.length > 1 || !seleccionado) && (
              <div className="grid max-w-md gap-2">
                <label htmlFor="ambito-institucional" className="text-sm font-semibold">Institución y sede</label>
                <select id="ambito-institucional" value={seleccionado ? String(seleccionado.vinculo_id) : ""}
                  onChange={evento => elegirVinculo(evento.target.value)}
                  className="min-h-11 w-full min-w-0 truncate rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <option value="" disabled>Selecciona una institución y sede</option>
                  {instituciones.map(item => (
                    <option key={item.vinculo_id} value={item.vinculo_id}>
                      {item.sede ? `${item.nombre} · ${item.sede.nombre}` : item.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {seleccionado && (
              <ProgramacionInstitucional key={seleccionado.vinculo_id} ambito={seleccionado}
                usuarioId={identidad.id} actualizarAmbitos={() => void ambito.refetch()} />
            )}
          </>
        )}
        {seccion === "cuenta" && (
          <DatosCuentaPortal nombre={identidad.nombre} correo={identidad.correo}
            verificado={ambito.isSuccess ? instituciones.some(item => item.correo_verificado) : null} />
        )}
      </div>
    </PanelOperativo>
  );
}
