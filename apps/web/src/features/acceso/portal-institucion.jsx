import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, House, UserRound } from "lucide-react";
import PanelOperativo from "@/shared/components/PanelOperativo";
import { consultarMiInstitucion, ErrorSesion, mensajeSesion } from "./cliente-sesion";

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

export default function PortalInstitucion({ identidad }) {
  const [seccion, elegirSeccion] = useState("inicio");
  const titulo = useRef(null);
  const ambito = useQuery({
    queryKey: ["mi-institucion", identidad.id],
    queryFn: ({ signal }) => consultarMiInstitucion(signal),
    retry: false,
  });
  useEffect(() => { titulo.current?.focus(); }, [seccion]);
  const instituciones = ambito.data?.data ?? [];
  const principal = instituciones[0];

  return (
    <PanelOperativo grupos={secciones} activo={seccion} rol="Institución" nombre={identidad.nombre}
      alSeleccionar={elegirSeccion} alAbrirPerfil={() => elegirSeccion("cuenta")}>
      <div className="panel-pagina max-w-5xl space-y-5">
        <header className="rounded-2xl border border-border border-t-4 border-t-primary bg-card p-5 sm:p-8">
          <h1 ref={titulo} tabIndex={-1} className="text-2xl font-semibold [overflow-wrap:anywhere] sm:text-3xl">
            {titulos[seccion]}
          </h1>
          {seccion === "inicio" && <p className="mt-3 text-muted-foreground [overflow-wrap:anywhere]">Bienvenido, {identidad.nombre}.</p>}
        </header>
        {ambito.isPending && <p role="status">Cargando tu institución…</p>}
        {ambito.isError && <p role="alert">{ambito.error instanceof ErrorSesion && ambito.error.estado === 403
          ? "Tu vínculo institucional no está activo." : mensajeSesion(ambito.error)}</p>}
        {seccion === "inicio" && principal && (
          <div className="grid gap-2 rounded-2xl border bg-card p-5 text-sm">
            <p className="text-lg font-semibold [overflow-wrap:anywhere]">{principal.nombre}</p>
            <p>{tipos[principal.tipo] ?? principal.tipo}</p>
            <p>NIT {principal.nit}</p>
            <p>Sede autorizada: {principal.sede?.nombre ?? "Sin sede"}</p>
          </div>
        )}
        {seccion === "institucion" && instituciones.map(item => (
          <div key={item.institucion_id} className="grid gap-2 rounded-2xl border bg-card p-5 text-sm [overflow-wrap:anywhere]">
            <p><strong>Razón social. </strong>{item.nombre}</p>
            <p><strong>NIT. </strong>{item.nit}</p>
            <p><strong>Tipo. </strong>{tipos[item.tipo] ?? item.tipo}</p>
            <p><strong>Sede autorizada. </strong>{item.sede?.nombre ?? "Sin sede"}</p>
            <p><strong>Representante. </strong>{item.representante}</p>
            <p><strong>Correo. </strong>{item.correo}</p>
          </div>
        ))}
        {seccion === "programacion" && (
          <p>No hay programación disponible. La consulta de eventos de tu institución todavía no está habilitada.</p>
        )}
        {seccion === "cuenta" && (
          <div className="grid gap-3 rounded-2xl border bg-card p-5 text-sm [overflow-wrap:anywhere]">
            <p><strong>Nombre. </strong>{identidad.nombre}</p>
            <p><strong>Correo. </strong>{identidad.correo}</p>
            <p>{principal?.correo_verificado ? "Correo verificado." : "Correo sin verificación confirmada."}</p>
            <Link to="/recuperar-contrasena" className="inline-flex min-h-11 items-center underline">Recuperar contraseña</Link>
          </div>
        )}
      </div>
    </PanelOperativo>
  );
}
