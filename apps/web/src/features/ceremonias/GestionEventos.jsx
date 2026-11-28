import { useContext, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, GraduationCap, Plus } from "lucide-react";
import { toast } from "sonner";
import { ContextoSesion } from "@/features/acceso/contexto-sesion";
import { ErrorSesion } from "@/features/acceso/cliente-sesion";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import DatosEvento from "./datos-evento";
import { EditorEvento } from "./editor-evento";
import { cancelarEvento, consultarEvento, consultarEventos, consultarInstituciones, mensajeEventos } from "./cliente-eventos";

const estados = {
  proximo: { texto: "Próximo", estilo: "bg-info-suave text-info" },
  en_ejecucion: { texto: "En ejecución", estilo: "bg-aviso-suave text-aviso" },
  finalizado: { texto: "Finalizado", estilo: "bg-exito-suave text-exito" },
  cancelado: { texto: "Cancelado", estilo: "bg-error-suave text-error" },
};
const selector = "block w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground min-h-11";

function escucharConexion(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
const leerConexion = () => navigator.onLine;
const opcionesConsulta = {
  refetchOnWindowFocus: "always",
  refetchOnReconnect: "always",
  gcTime: 0,
  retry: (fallos, error) => fallos < 1 && (!(error instanceof ErrorSesion) || error.estado === 0 || error.estado >= 500),
};

function EstadoConsulta({ consulta, alReintentar = consulta.refetch }) {
  if (consulta.isError) return (
    <div className="space-y-2">
      <p role="alert" className="text-sm text-error">{mensajeEventos(consulta.error)}</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => alReintentar()}>Volver a intentar</Button>
    </div>
  );
  if (consulta.isPending && consulta.fetchStatus !== "paused") {
    return <p role="status" className="text-sm text-muted-foreground">Cargando programación…</p>;
  }
  return null;
}

export default function GestionEventos({ actorId }) {
  const [vista, setVista] = useState("activa");
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({});
  const [rangoInvalido, setRangoInvalido] = useState(false);
  const consultaCliente = useQueryClient();
  const sesion = useContext(ContextoSesion);
  const conectado = useSyncExternalStore(escucharConexion, leerConexion);
  const encabezado = useRef(null);
  const clave = ["programacion", actorId];
  const consulta = useQuery({
    ...opcionesConsulta,
    queryKey: [...clave, "listado", vista, pagina, filtros],
    queryFn: ({ signal }) => consultarEventos(pagina, signal, { ...filtros, vista }),
  });
  const catalogo = useQuery({
    ...opcionesConsulta,
    queryKey: [...clave, "instituciones"],
    queryFn: ({ signal }) => consultarInstituciones(signal),
  });
  const listado = consulta.data;
  const revisarSesion = () => sesion?.comprobar();

  function actualizar(evento, mensaje) {
    const claveDetalle = [...clave, "detalle", evento.id];
    if (consultaCliente.getQueryState(claveDetalle)) consultaCliente.setQueryData(claveDetalle, evento);
    void consultaCliente.invalidateQueries({ queryKey: clave });
    toast.success(mensaje);
    if (evento.estado === "cancelado") setTimeout(() => encabezado.current?.focus(), 0);
  }

  function cambiarVista(siguiente) {
    if (siguiente === vista) return;
    setVista(siguiente);
    setPagina(1);
    setFiltros(({ estado: _estado, ...otros }) => otros);
  }

  function filtrar(e) {
    e.preventDefault();
    const valores = Object.fromEntries(new FormData(e.currentTarget));
    const invalido = Boolean(valores.desde && valores.hasta && valores.hasta < valores.desde);
    setRangoInvalido(invalido);
    if (invalido) {
      e.currentTarget.elements.namedItem("hasta").focus();
      return;
    }
    setFiltros(valores);
    setPagina(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 ref={encabezado} tabIndex={-1} className="font-heading text-2xl font-bold">Gestión de Eventos</h2>
          {listado && <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">{listado.total} {listado.total === 1 ? "evento" : "eventos"}</p>}
        </div>
        <EditorEvento catalogo={catalogo} conectado={conectado} clave={clave} alGuardar={actualizar} alVencerSesion={revisarSesion}>
          <Button type="button" className="min-h-11"><Plus aria-hidden="true" /> Crear evento</Button>
        </EditorEvento>
      </div>
      {!conectado && <p role="status" className="rounded-md bg-aviso-suave p-3 text-sm text-aviso">Sin conexión. Puedes consultar la información que ya está abierta. Conéctate para actualizarla o guardar cambios.</p>}
      <div role="group" aria-label="Vista de eventos" className="flex flex-wrap gap-2">
        <Button type="button" aria-pressed={vista === "activa"} className="min-h-11" variant={vista === "activa" ? "default" : "outline"}
          onClick={() => cambiarVista("activa")}>Programación activa</Button>
        <Button type="button" aria-pressed={vista === "historial"} className="min-h-11" variant={vista === "historial" ? "default" : "outline"}
          onClick={() => cambiarVista("historial")}>Historial</Button>
      </div>
      <form onSubmit={filtrar} className="grid min-w-0 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="eventos-buscar">Buscar por institución, evento o lugar</Label>
          <Input id="eventos-buscar" name="buscar" type="search" maxLength={120} className="min-h-11" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="eventos-institucion">Institución</Label>
          <select id="eventos-institucion" name="institucion_id" className={selector} disabled={!catalogo.data}>
            <option value="">Todas</option>
            {catalogo.data?.map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
          </select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="eventos-estado">Estado</Label>
          <select key={vista} id="eventos-estado" name="estado" className={selector}>
            <option value="">Todos</option>
            {(vista === "activa" ? ["proximo", "en_ejecucion"] : ["finalizado", "cancelado"])
              .map(estado => <option key={estado} value={estado}>{estados[estado].texto}</option>)}
          </select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="eventos-desde">Desde</Label>
          <Input id="eventos-desde" name="desde" type="date" className="min-h-11 min-w-0" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="eventos-hasta">Hasta</Label>
          <Input id="eventos-hasta" name="hasta" type="date" className="min-h-11 min-w-0"
            aria-invalid={rangoInvalido || undefined} aria-describedby={rangoInvalido ? "eventos-error-rango" : undefined} />
          {rangoInvalido && <p id="eventos-error-rango" role="alert" className="text-sm text-error">La fecha final debe ser igual o posterior a la inicial.</p>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" variant="outline" className="min-h-11">Aplicar filtros</Button>
          <Button type="reset" variant="ghost" className="min-h-11" onClick={() => { setFiltros({}); setPagina(1); setRangoInvalido(false); }}>Limpiar</Button>
        </div>
      </form>
      <EstadoConsulta consulta={consulta} alReintentar={() => consulta.error?.estado === 401 ? revisarSesion() : consulta.refetch()} />
      {catalogo.isError && listado && (
        <p role="alert" className="text-sm text-error">No se pudo cargar el filtro de instituciones. <button type="button" className="underline" onClick={() => catalogo.refetch()}>Volver a cargar</button></p>
      )}
      {listado?.eventos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <CalendarDays aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-semibold">No hay eventos para esta consulta.</p>
          </CardContent>
        </Card>
      )}
      <ul className="space-y-4">
        {listado?.eventos.map(evento => (
          <li key={evento.id}><TarjetaEvento evento={evento} hoy={listado.fechaOperativa} clave={clave} catalogo={catalogo}
            conectado={conectado} alGuardar={actualizar} alVencerSesion={revisarSesion} /></li>
        ))}
      </ul>
      {(pagina > 1 || listado?.hayMas) && (
        <nav aria-label="Páginas de eventos" className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span aria-live="polite" className="px-2 text-sm">Página {pagina}</span>
          <Button type="button" variant="outline" className="min-h-11" disabled={!listado?.hayMas} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
        </nav>
      )}
    </div>
  );
}

function TarjetaEvento({ evento, hoy, clave, catalogo, conectado, alGuardar, alVencerSesion }) {
  const [abierto, setAbierto] = useState(false);
  const detalle = useQuery({
    ...opcionesConsulta,
    queryKey: [...clave, "detalle", evento.id],
    queryFn: ({ signal }) => consultarEvento(evento.id, signal),
    enabled: abierto,
  });
  const datos = detalle.data;
  const dias = Math.round((Date.parse(evento.fecha) - Date.parse(hoy)) / 86400000);
  const tipo = { colegio: "Colegio", universidad: "Universidad" }[evento.institucion.tipo] ?? evento.institucion.tipo;
  const estado = estados[evento.estado];
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <GraduationCap aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <h3 className="min-w-0 break-words font-heading text-lg font-bold">{evento.institucion.nombre}</h3>
          <Badge variant={evento.institucion.tipo === "colegio" ? "secondary" : "default"}>{tipo}</Badge>
          <Badge variant="outline" className={"border-transparent " + estado.estilo}>{estado.texto}</Badge>
          {evento.estado === "proximo" && <Badge variant="outline" className="border-transparent bg-muted text-foreground">{dias === 1 ? "Mañana" : "En " + dias + " días"}</Badge>}
          {evento.estado === "en_ejecucion" && <Badge variant="secondary">Hoy</Badge>}
        </div>
        <p className="break-words text-sm text-muted-foreground">{evento.sede?.nombre ?? "Sede sin confirmar"}</p>
        <DatosEvento fecha={evento.fecha} lugar={evento.lugar} />
        <Button type="button" variant="outline" className="min-h-11 whitespace-normal" aria-expanded={abierto} aria-controls={"evento-detalle-" + evento.id}
          onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar detalles" : "Ver detalles"} · {evento.numero_ceremonias} {evento.numero_ceremonias === 1 ? "ceremonia" : "ceremonias"}</Button>
        <div hidden={!abierto} id={"evento-detalle-" + evento.id} className="space-y-3 border-t pt-3 text-sm">
          {abierto && <EstadoConsulta consulta={detalle} />}
          {abierto && detalle.fetchStatus === "paused" && !datos && <p role="status">Conéctate para consultar los detalles.</p>}
          {abierto && datos && (
            <>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div><dt className="font-semibold">Número de evento</dt><dd>{datos.id}</dd></div>
                <div><dt className="font-semibold">Graduandos previstos</dt><dd>{datos.graduandos_previstos ?? "Sin registrar"}</dd></div>
                <div className="min-w-0"><dt className="font-semibold">Responsable</dt><dd className="break-words">{datos.responsable ?? "Sin registrar"}</dd></div>
                {datos.observaciones && <div className="min-w-0 sm:col-span-2"><dt className="font-semibold">Observaciones</dt><dd className="whitespace-pre-wrap break-words">{datos.observaciones}</dd></div>}
                {datos.cancelado_en && <div><dt className="font-semibold">Fecha de cancelación</dt><dd><time dateTime={datos.cancelado_en}>{new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(datos.cancelado_en))}</time></dd></div>}
              </dl>
              <ul className="grid gap-2 sm:grid-cols-2">
                {datos.ceremonias.map(ceremonia => (
                  <li key={ceremonia.id} className="min-w-0 space-y-1 break-words rounded-md border border-border bg-muted p-3">
                    <p className="font-semibold">{ceremonia.nombre}</p>
                    <p>{ceremonia.hora ? <time>{ceremonia.hora.slice(0, 5)}</time> : "Hora por definir"}</p>
                    {ceremonia.graduandos_vinculados > 0 && <p className="text-muted-foreground">Graduandos vinculados: {ceremonia.graduandos_vinculados}</p>}
                    {ceremonia.programas?.length > 0 && <p className="text-muted-foreground">Programas: {ceremonia.programas.join(", ")}</p>}
                  </li>
                ))}
              </ul>
              {(datos.estado === "proximo" || datos.estado === "en_ejecucion") && (
                <div className="flex flex-wrap gap-2">
                  <EditorEvento evento={datos} catalogo={catalogo} conectado={conectado} clave={clave} alGuardar={alGuardar} alVencerSesion={alVencerSesion}>
                    <Button type="button" variant="outline" className="min-h-11">Editar evento</Button>
                  </EditorEvento>
                  {datos.estado === "proximo" && <ConfirmarCancelacion evento={datos} conectado={conectado} alGuardar={alGuardar} alVencerSesion={alVencerSesion} />}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmarCancelacion({ evento, conectado, alGuardar, alVencerSesion }) {
  const [abierto, setAbierto] = useState(false);
  const procesando = useRef(false);
  const cancelacion = useMutation({ mutationFn: () => cancelarEvento(evento.id), networkMode: "always", gcTime: 0 });

  async function confirmar() {
    if (!conectado || procesando.current) return;
    procesando.current = true;
    try {
      const actualizado = await cancelacion.mutateAsync();
      setAbierto(false);
      alGuardar(actualizado, "Evento cancelado. Puedes consultarlo en Historial.");
    } catch (error) {
      if (error instanceof ErrorSesion && error.estado === 401) alVencerSesion();
    } finally {
      procesando.current = false;
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={valor => {
      if (procesando.current) return;
      if (valor) cancelacion.reset();
      setAbierto(valor);
    }}>
      <AlertDialogTrigger asChild><Button type="button" variant="outline" className="min-h-11 text-error">Cancelar evento</Button></AlertDialogTrigger>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar este evento?</AlertDialogTitle>
          <AlertDialogDescription>El evento pasará al historial. Sus ceremonias e inscripciones se conservarán y se cerrarán nuevas inscripciones.</AlertDialogDescription>
        </AlertDialogHeader>
        {(!conectado || cancelacion.isError) && <p role="alert" className="text-sm text-error">{!conectado ? "Recupera la conexión para confirmar la cancelación." : mensajeEventos(cancelacion.error)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={cancelacion.isPending}>Volver</AlertDialogCancel>
          <Button type="button" variant="destructive" className="min-h-11 whitespace-normal" disabled={!conectado || cancelacion.isPending} onClick={confirmar}>
            {cancelacion.isPending ? "Cancelando…" : "Confirmar cancelación"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
