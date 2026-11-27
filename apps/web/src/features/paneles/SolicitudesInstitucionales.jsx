import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buttonVariants } from "@/shared/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import {
  consultarSolicitudInstitucional, decidirSolicitudInstitucional, ErrorSesion,
  listarSolicitudesInstitucionales, mensajeSesion, reintentarAvisoInstitucional,
} from "@/features/acceso/cliente-sesion";

const filtros = [
  { id: "pendiente", etiqueta: "Pendientes" },
  { id: "aprobada", etiqueta: "Aprobadas" },
  { id: "rechazada", etiqueta: "Rechazadas" },
];
const tipos = { colegio: "Colegio", universidad: "Universidad" };

function fecha(valor) {
  if (!valor) return "Sin fecha";
  const momento = new Date(valor);
  return Number.isNaN(momento.getTime()) ? valor : new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium", timeStyle: "short",
  }).format(momento);
}

function textoAviso(estado, detalle) {
  if (estado === "enviada") return "La decisión quedó guardada y el aviso fue entregado.";
  if (estado === "enviando") return "La decisión quedó guardada. El aviso está en curso.";
  if (estado === "fallida") return `La decisión quedó guardada. El aviso no se entregó${detalle ? `: ${detalle}` : "."}`;
  if (estado === "pendiente") return "La decisión quedó guardada. El aviso quedó en cola.";
  return "La decisión quedó guardada.";
}

function mensajeError(error) {
  if (error instanceof ErrorSesion) {
    if (error.estado === 409 && error.aviso) return error.aviso;
    if (error.estado === 403) return "Tu cuenta no puede decidir solicitudes institucionales.";
    if (error.estado === 404) return "La solicitud ya no está disponible.";
    if (error.estado === 422) return "Revisa el motivo del rechazo. Debe ser un texto claro de 12 a 500 caracteres.";
  }
  return mensajeSesion(error);
}

export default function SolicitudesInstitucionales() {
  const [estado, establecerEstado] = useState("pendiente");
  const [pagina, establecerPagina] = useState(1);
  const [busqueda, establecerBusqueda] = useState("");
  const [seleccion, establecerSeleccion] = useState(null);
  const [confirmar, establecerConfirmar] = useState(false);
  const [rechazo, establecerRechazo] = useState(false);
  const [motivo, establecerMotivo] = useState("");
  const [errorMotivo, establecerErrorMotivo] = useState("");
  const [aviso, establecerAviso] = useState("");
  const cliente = useQueryClient();
  const lista = useQuery({
    queryKey: ["solicitudes-institucionales", estado, pagina],
    queryFn: ({ signal }) => listarSolicitudesInstitucionales(estado, pagina, signal),
    retry: false,
  });
  const detalle = useQuery({
    queryKey: ["solicitud-institucional", seleccion],
    queryFn: ({ signal }) => consultarSolicitudInstitucional(seleccion, signal),
    enabled: seleccion !== null,
    retry: false,
  });
  const decision = useMutation({
    mutationFn: accion => decidirSolicitudInstitucional(accion.id, accion.tipo, accion.motivo),
    onSuccess: async resultado => {
      establecerAviso(textoAviso(resultado.data.notificacion?.estado, resultado.data.notificacion?.detalle));
      establecerConfirmar(false);
      establecerRechazo(false);
      establecerMotivo("");
      await cliente.invalidateQueries({ queryKey: ["solicitudes-institucionales"] });
      await cliente.invalidateQueries({ queryKey: ["solicitud-institucional", resultado.data.id] });
    },
  });
  const reintento = useMutation({
    mutationFn: id => reintentarAvisoInstitucional(id),
    onSuccess: async () => {
      establecerAviso("Se solicitó de nuevo el aviso, sin repetir la decisión.");
      await cliente.invalidateQueries({ queryKey: ["solicitud-institucional", seleccion] });
      await cliente.invalidateQueries({ queryKey: ["solicitudes-institucionales"] });
    },
  });
  const ocupado = decision.isPending || reintento.isPending;
  const texto = busqueda.trim().toLocaleLowerCase("es-CO");
  const visibles = (lista.data?.data ?? []).filter(solicitud => !texto || [
    solicitud.razon_social, solicitud.nit, solicitud.email, solicitud.representante,
  ].some(campo => campo.toLocaleLowerCase("es-CO").includes(texto)));
  const ficha = detalle.data?.data;
  const avisoVisible = ficha?.notificacion
    ? textoAviso(ficha.notificacion.estado, ficha.notificacion.detalle)
    : aviso;

  const rechazar = () => {
    const limpio = motivo.trim();
    if (limpio.length < 12 || limpio.length > 500) {
      establecerErrorMotivo("Escribe un motivo claro, de 12 a 500 caracteres.");
      return;
    }
    if (seleccion === null) return;
    establecerErrorMotivo("");
    decision.mutate({ id: seleccion, tipo: "rechazo", motivo: limpio });
  };

  return (
    <section aria-label="Solicitudes institucionales" className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {filtros.map(filtro => (
          <button key={filtro.id} type="button" aria-pressed={estado === filtro.id}
            className={buttonVariants({ variant: estado === filtro.id ? "default" : "outline" })}
            onClick={() => { establecerEstado(filtro.id); establecerPagina(1); establecerSeleccion(null); establecerAviso(""); }}>
            {filtro.etiqueta}
          </button>
        ))}
      </div>
      <label className="grid max-w-md gap-1 text-sm font-medium" htmlFor="buscar-solicitud">
        Buscar en esta página
        <input id="buscar-solicitud" value={busqueda} onChange={evento => establecerBusqueda(evento.target.value)}
          placeholder="Institución, NIT, representante o correo"
          className="h-11 rounded-md border bg-background px-3 text-base" />
      </label>
      {(lista.isError || decision.isError || reintento.isError || detalle.isError) && (
        <p role="alert">{mensajeError(lista.error || decision.error || reintento.error || detalle.error)}</p>
      )}
      <p role="status">{ocupado ? "Guardando la decisión…" : avisoVisible || (lista.isPending ? "Cargando solicitudes…" : "")}</p>
      {lista.data && visibles.length === 0 && <p>No hay solicitudes para este filtro.</p>}
      <ul className="space-y-3">
        {visibles.map(solicitud => (
          <li key={solicitud.id}>
            <button type="button" className="w-full rounded-lg border bg-card p-4 text-left"
              onClick={() => { establecerSeleccion(solicitud.id); establecerAviso(""); }}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold [overflow-wrap:anywhere]">{solicitud.razon_social}</span>
                <span className="rounded-md border px-2 py-0.5 text-xs font-semibold">{tipos[solicitud.tipo]}</span>
              </span>
              <span className="mt-2 grid gap-1 text-sm text-muted-foreground">
                <span>NIT {solicitud.nit} · {solicitud.sede}</span>
                <span className="[overflow-wrap:anywhere]">{solicitud.representante} · {solicitud.email}</span>
                <span>{fecha(solicitud.creada_en)} · {solicitud.estado}</span>
                {solicitud.notificacion_estado && <span>Aviso: {solicitud.notificacion_estado}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonVariants({ variant: "outline" })} disabled={pagina === 1 || lista.isPending}
          onClick={() => establecerPagina(actual => Math.max(1, actual - 1))}>Anterior</button>
        <button type="button" className={buttonVariants({ variant: "outline" })} disabled={!lista.data?.hayMas || lista.isPending}
          onClick={() => establecerPagina(actual => actual + 1)}>Siguiente</button>
      </div>

      <Dialog open={seleccion !== null} onOpenChange={abierto => { if (!abierto && !ocupado) { establecerSeleccion(null); establecerAviso(""); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de la solicitud</DialogTitle>
            <DialogDescription>La decisión la confirma el servidor. Esta pantalla no asigna permisos.</DialogDescription>
          </DialogHeader>
          {ficha && <Ficha detalle={ficha} />}
          <DialogFooter className="flex-wrap gap-2">
            {ficha?.estado === "pendiente" && (
              <>
                <button type="button" className={buttonVariants()} disabled={ocupado} onClick={() => establecerConfirmar(true)}>Aprobar</button>
                <button type="button" className={buttonVariants({ variant: "destructive" })} disabled={ocupado}
                  onClick={() => { establecerRechazo(true); establecerErrorMotivo(""); }}>Rechazar</button>
              </>
            )}
            {ficha && ["pendiente", "fallida"].includes(ficha.notificacion?.estado) && (
              <button type="button" className={buttonVariants({ variant: "outline" })} disabled={ocupado}
                onClick={() => reintento.mutate(seleccion)}>Reintentar aviso</button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmar} onOpenChange={establecerConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar solicitud</DialogTitle>
            <DialogDescription>Se creará el vínculo autorizado y se encolará el aviso. Esta acción no se puede repetir.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className={buttonVariants({ variant: "outline" })} disabled={ocupado}
              onClick={() => establecerConfirmar(false)}>Cancelar</button>
            <button type="button" className={buttonVariants()} disabled={ocupado || seleccion === null}
              onClick={() => decision.mutate({ id: seleccion, tipo: "aprobacion" })}>Confirmar aprobación</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rechazo} onOpenChange={establecerRechazo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
            <DialogDescription>El motivo es obligatorio y se envía en el aviso de rechazo.</DialogDescription>
          </DialogHeader>
          <label className="grid gap-1 text-sm font-medium" htmlFor="motivo-rechazo">Motivo
            <textarea id="motivo-rechazo" value={motivo} maxLength={500} rows={4}
              className="min-h-24 rounded-md border bg-background px-3 py-2 text-base"
              onChange={evento => establecerMotivo(evento.target.value)} />
          </label>
          {errorMotivo && <p role="alert" className="text-sm text-destructive">{errorMotivo}</p>}
          <DialogFooter className="gap-2">
            <button type="button" className={buttonVariants({ variant: "outline" })} disabled={ocupado}
              onClick={() => establecerRechazo(false)}>Cancelar</button>
            <button type="button" className={buttonVariants({ variant: "destructive" })} disabled={ocupado}
              onClick={rechazar}>Confirmar rechazo</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Ficha({ detalle }) {
  const filas = [
    ["Institución", detalle.razon_social],
    ["Tipo", tipos[detalle.tipo]],
    ["NIT", detalle.nit],
    ["Sede", detalle.sede],
    ["Representante", detalle.representante],
    ["Correo", detalle.email],
    ["Teléfono", detalle.telefono],
    ["Estado", detalle.estado],
    ["Creada", fecha(detalle.creada_en)],
    ["Activación", detalle.activada_en ? fecha(detalle.activada_en) : detalle.requiere_activacion ? "Pendiente de contraseña" : "No requerida"],
    ["Aviso", detalle.notificacion ? `${detalle.notificacion.estado}${detalle.notificacion.detalle ? ` — ${detalle.notificacion.detalle}` : ""}` : "Sin aviso"],
    ["Decisión", detalle.decision ? `${detalle.decision.estado} · ${fecha(detalle.decision.en)}` : "Sin decisión"],
    ["Motivo", detalle.decision?.motivo || "Sin motivo"],
  ];
  return (
    <div className="grid gap-2 rounded-lg border p-4 text-sm">
      {filas.map(([etiqueta, valor]) => (
        <p key={etiqueta} className="[overflow-wrap:anywhere]"><strong>{etiqueta}. </strong>{valor}</p>
      ))}
    </div>
  );
}
