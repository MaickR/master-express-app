import React, { useState, useEffect, useRef, useContext } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import { ContextoSesion } from "@/features/acceso/contexto-sesion";
import { ErrorSesion } from "@/features/acceso/cliente-sesion";
import {
  camposAlta, consultarCeremonias, consultarEventos, consultarInstituciones,
  crearEvento as crearEventoLaravel, ensayoLaravel, mensajeEventos,
} from "@/features/ceremonias/cliente-eventos";
import { CalendarDays, Plus, Trash2, GraduationCap, ArrowUpDown, FlaskConical } from "lucide-react";
import DatosEvento from "./datos-evento";
import { Card, CardContent } from "@/shared/ui/card";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Dialog, DialogContent, DialogDescription as Descripcion, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { toast } from "sonner";

// * Los componentes JSX compartidos reenvían estas props sin declararlas en sus tipos inferidos.
/** @type {React.ComponentType<import("@radix-ui/react-dialog").DialogDescriptionProps>} */
const DescripcionEnsayo = Descripcion;
/** @type {React.ComponentType<import("@radix-ui/react-label").LabelProps>} */
const EtiquetaInstitucion = Label;
/** @type {React.ComponentType<import("@radix-ui/react-select").SelectTriggerProps>} */
const SelectorInstitucion = SelectTrigger;
/** @type {React.ComponentType<import("@radix-ui/react-select").SelectContentProps>} */
const MenuInstituciones = SelectContent;
/** @type {React.ComponentType<import("@radix-ui/react-select").SelectItemProps>} */
const OpcionInstitucion = SelectItem;
/** @type {React.ComponentType<React.ComponentPropsWithoutRef<"button"> & import("class-variance-authority").VariantProps<typeof buttonVariants>>} */
const BotonEnsayo = Button;

/** @type {{ nombre_institucion: string, tipo_institucion: string, institucion_id?: string, sede_id?: string, fecha: string, lugar: string, numero_ceremonias: number }} */
const eventoInicial = {
  nombre_institucion: "",
  tipo_institucion: "universidad",
  fecha: "",
  lugar: "",
  numero_ceremonias: 1
};

const mensajesCampo = {
  institucion: "Selecciona una institución vigente de la lista.",
  sede: "Selecciona una sede de la institución elegida.",
  fecha: "Ingresa una fecha válida.",
  lugar: "Ingresa un lugar de hasta 255 caracteres.",
  numCer: "Selecciona entre una y seis ceremonias.",
};

export default function GestionEventos({ onUpdate }) {
  const [eventos, setEventos] = useState([]);
  const [ceremonias, setCeremonias] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const creandoEvento = useRef(false);
  const [showNew, setShowNew] = useState(false);
  const [ordenEvento, setOrdenEvento] = useState("proximo"); // proximo | lejano | cronologico
  const [newEvento, setNewEvento] = useState(eventoInicial);
  // * Estado exclusivo del ensayo con Laravel.
  const sesion = useContext(ContextoSesion);
  const consultas = useRef(null);
  const operacion = useRef(null);
  const campoPorEnfocar = useRef(null);
  const [instituciones, setInstituciones] = useState([]);
  const sedes = instituciones.find(inst => String(inst.id) === newEvento.institucion_id)?.sedes ?? [];
  const [errorCarga, setErrorCarga] = useState("");
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [erroresAlta, setErroresAlta] = useState({});
  const [errorAlta, setErrorAlta] = useState("");
  const [abiertas, setAbiertas] = useState({});
  const [estadoCeremonias, setEstadoCeremonias] = useState({});

  useEffect(() => {
    consultas.current = new AbortController();
    loadEventos();
    return () => consultas.current.abort();
  }, []);

  const revisarSesion = (error) => {
    if (error instanceof ErrorSesion && error.estado === 401) sesion?.comprobar();
  };

  const cargarEnsayo = async (siguiente = 1, creado = null) => {
    const { signal } = consultas.current;
    setErrorCarga("");
    try {
      const [{ eventos: lista, hayMas: mas }, opciones] = await Promise.all([
        consultarEventos(siguiente, signal),
        siguiente === 1 ? consultarInstituciones(signal) : null,
      ]);
      const nuevos = creado && !lista.some(ev => ev.id === creado.id) ? [creado, ...lista] : lista;
      setEventos(previos => siguiente === 1
        ? nuevos : [...previos, ...lista.filter(ev => !previos.some(previo => previo.id === ev.id))]);
      if (opciones) setInstituciones(opciones);
      setPagina(siguiente);
      setHayMas(mas);
    } catch (error) {
      if (signal.aborted) return;
      setErrorCarga(mensajeEventos(error));
      revisarSesion(error);
    }
    setLoading(false);
  };

  const cargarMas = async () => {
    setCargandoMas(true);
    await cargarEnsayo(pagina + 1);
    setCargandoMas(false);
  };

  const cargarCeremonias = async (id) => {
    setEstadoCeremonias(previo => ({ ...previo, [id]: "cargando" }));
    try {
      const lista = await consultarCeremonias(id, consultas.current.signal);
      setCeremonias(previo => ({ ...previo, [id]: lista }));
      setEstadoCeremonias(previo => ({ ...previo, [id]: "" }));
    } catch (error) {
      setEstadoCeremonias(previo => ({ ...previo, [id]: mensajeEventos(error) }));
      revisarSesion(error);
    }
  };

  const alternarCeremonias = (id) => {
    const abrir = !abiertas[id];
    setAbiertas(previo => ({ ...previo, [id]: abrir }));
    if (abrir && !ceremonias[id] && estadoCeremonias[id] !== "cargando") cargarCeremonias(id);
  };

  const loadEventos = async () => {
    if (ensayoLaravel) return cargarEnsayo();
    try {
      const data = await base44.entities.Evento.list();
      setEventos(data);
      // Carga de ceremonias en paralelo
      const cerEntries = await Promise.all(
        data.map(ev =>
          base44.entities.Ceremonia.filter({ evento_id: ev.id }).then(cers => [ev.id, cers])
        )
      );
      const cerData = Object.fromEntries(cerEntries);
      setCeremonias(cerData);
    } catch (error) {
      console.error("Error cargando eventos:", error);
    }
    setLoading(false);
  };

  const crearEnsayo = async () => {
    const errores = {};
    if (!instituciones.some(inst => String(inst.id) === newEvento.institucion_id)) errores.institucion = mensajesCampo.institucion;
    if (!sedes.some(sede => String(sede.id) === newEvento.sede_id)) errores.sede = mensajesCampo.sede;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newEvento.fecha) || newEvento.fecha < "1000-01-01") errores.fecha = mensajesCampo.fecha;
    campoPorEnfocar.current = Object.keys(errores)[0];
    setErroresAlta(errores);
    setErrorAlta("");
    if (Object.keys(errores).length > 0) return;

    creandoEvento.current = true;
    setSaving(true);
    // ! El mismo identificador acompaña cada reintento hasta confirmar el alta o recibir un conflicto.
    operacion.current ??= crypto.randomUUID();
    try {
      const { evento, ceremonias: lista } = await crearEventoLaravel({
        institucion_id: Number(newEvento.institucion_id),
        sede_id: Number(newEvento.sede_id),
        fecha: newEvento.fecha,
        lugar: newEvento.lugar.trim() || null,
        numero_ceremonias: newEvento.numero_ceremonias,
        operation_id: operacion.current,
      });
      operacion.current = null;
      toast.success("Evento creado en el ensayo Laravel");
      setShowNew(false);
      setNewEvento(eventoInicial);
      setEventos(previos => previos.some(previo => previo.id === evento.id) ? previos : [evento, ...previos]);
      setCeremonias(previo => ({ ...previo, [evento.id]: lista }));
      setAbiertas(previo => ({ ...previo, [evento.id]: true }));
      cargarEnsayo(1, evento);
    } catch (error) {
      if (error instanceof ErrorSesion && error.estado === 409) {
        operacion.current = null;
        cargarEnsayo();
      }
      if (error instanceof ErrorSesion && error.estado === 422) {
        const camposInvalidos = error.campos.filter(campo => campo in camposAlta).map(campo => camposAlta[campo]);
        campoPorEnfocar.current = camposInvalidos[0];
        setErroresAlta(Object.fromEntries(camposInvalidos.map(campo => [campo, mensajesCampo[campo]])));
        if (error.campos.some(campo => campo === "evento.institucion_id" || campo === "evento.sede_id")) cargarEnsayo();
      }
      setErrorAlta(mensajeEventos(error));
      revisarSesion(error);
    } finally {
      creandoEvento.current = false;
      setSaving(false);
    }
  };

  const crearEvento = async () => {
    if (creandoEvento.current) return;
    if (ensayoLaravel) return crearEnsayo();
    if (!newEvento.nombre_institucion.trim() || !newEvento.fecha) {
      toast.error("Nombre de institución y fecha son obligatorios");
      return;
    }
    creandoEvento.current = true;
    setSaving(true);
    try {
      const evento = await base44.entities.Evento.create({ ...newEvento, activo: true });
      await Promise.all(
        Array.from({ length: newEvento.numero_ceremonias }, (_, i) =>
          base44.entities.Ceremonia.create({ evento_id: evento.id, nombre: `Ceremonia ${i + 1}`, orden: i + 1 })
        )
      );
      toast.success("Evento creado exitosamente");
      setShowNew(false);
      setNewEvento(eventoInicial);
      loadEventos();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Error al crear evento");
    } finally {
      creandoEvento.current = false;
      setSaving(false);
    }
  };

  const eliminarEvento = async (eventoId) => {
    if (!confirm("¿Eliminar este evento y sus ceremonias?")) return;
    try {
      const cers = ceremonias[eventoId] || [];
      await Promise.all(cers.map(cer => base44.entities.Ceremonia.delete(cer.id)));
      await base44.entities.Evento.delete(eventoId);
      toast.success("Evento eliminado");
      loadEventos();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Error al eliminar evento");
    }
  };


  // Ordenamiento dinámico
  const eventosOrdenados = [...eventos].sort((a, b) => {
    const da = new Date(a.fecha || 0).getTime();
    const db = new Date(b.fecha || 0).getTime();
    if (ordenEvento === "proximo") return da - db;
    if (ordenEvento === "lejano") return db - da;
    // cronologico = igual que próximo
    return da - db;
  });

  // Días restantes
  const diasRestantes = (fecha) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ev = new Date(fecha);
    const diff = Math.ceil((ev - hoy) / (1000 * 60 * 60 * 24));
    return diff;
  };

  useEffect(() => {
    if (showNew && !saving && campoPorEnfocar.current) {
      document.getElementById(campoPorEnfocar.current)?.focus();
      campoPorEnfocar.current = null;
    }
  }, [erroresAlta, saving, showNew]);

  const actualizarCampoAlta = (campo, cambios) => {
    setNewEvento(previo => ({ ...previo, ...cambios }));
    setErroresAlta(previos => {
      const errores = { ...previos };
      delete errores[campo];
      if (campo === "institucion") delete errores.sede;
      return errores;
    });
  };

  const avisoCampo = (campo) => erroresAlta[campo] && (
    <p id={`${campo}-error`} role="alert" className="text-sm text-error">{erroresAlta[campo]}</p>
  );
  const describirCampo = (campo) => erroresAlta[campo]
    ? { "aria-invalid": true, "aria-describedby": `${campo}-error` } : {};

  const listaCeremonias = (id) => [...(ceremonias[id] || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(cer => (
    <Badge key={cer.id} variant="outline" className="text-xs">
      {cer.nombre} {cer.hora ? `(${cer.hora})` : ''}
    </Badge>
  ));

  const campoFecha = (
    <div className="space-y-2">
      <Label htmlFor="fecha">Fecha *</Label>
      <Input id="fecha" type="date" value={newEvento.fecha} {...describirCampo("fecha")}
        onChange={e => actualizarCampoAlta("fecha", { fecha: e.target.value })} />
      {avisoCampo("fecha")}
    </div>
  );

  const avisoEnsayo = ensayoLaravel && (
    <div role="note" className="flex items-start gap-3 rounded-lg border border-aviso/40 bg-aviso-suave p-4 text-sm text-aviso">
      <FlaskConical aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p>
        <strong className="font-semibold">Modo de ensayo con Laravel.</strong> Usa datos ficticios de la base aislada
        de pruebas.
      </p>
    </div>
  );

  if (loading) return (
    <div className="space-y-6">
      {avisoEnsayo}
      <div role="status" className="flex items-center justify-center py-12">
        <div aria-hidden="true" className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
        <span className="sr-only">Cargando eventos…</span>
      </div>
    </div>
  );

  if (ensayoLaravel && errorCarga && eventos.length === 0) return (
    <div className="space-y-6">
      {avisoEnsayo}
      <div className="panel-estado">
        <p role="alert">{errorCarga}</p>
        <button type="button" onClick={() => { setLoading(true); cargarEnsayo(); }} className="panel-accion mx-auto">
          Volver a intentar
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {avisoEnsayo}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">Gestión de Eventos</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {eventos.length}{hayMas ? "+" : ""} evento(s) configurado(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de orden */}
          <Select value={ordenEvento} onValueChange={setOrdenEvento}>
            <SelectTrigger className="h-9 w-52 dark:w-48">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proximo">Más próximo primero</SelectItem>
              <SelectItem value="lejano">Más lejano primero</SelectItem>
              <SelectItem value="cronologico">Orden cronológico</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showNew} onOpenChange={abierto => { if (!saving) setShowNew(abierto); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                <Plus className="w-4 h-4 mr-2" /> Crear Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Nuevo Evento de Graduación
                </DialogTitle>
                {ensayoLaravel && (
                  <DescripcionEnsayo>Selecciona la institución y la sede donde se realizará el evento.</DescripcionEnsayo>
                )}
              </DialogHeader>
              <form className="space-y-4 py-4" noValidate onSubmit={e => { e.preventDefault(); crearEvento(); }}>
                <fieldset disabled={saving} className="min-w-0 space-y-4">
                  {ensayoLaravel ? (
                    <>
                      <div className="space-y-2">
                        <EtiquetaInstitucion htmlFor="institucion">Institución *</EtiquetaInstitucion>
                        <Select value={newEvento.institucion_id ?? ""} disabled={instituciones.length === 0}
                          onValueChange={v => actualizarCampoAlta("institucion", { institucion_id: v, sede_id: "" })}>
                          <SelectorInstitucion id="institucion" {...describirCampo("institucion")}>
                            <SelectValue placeholder={instituciones.length ? "Seleccionar institución" : "Sin instituciones disponibles"} />
                          </SelectorInstitucion>
                          <MenuInstituciones>
                            {instituciones.map(inst => (
                              <OpcionInstitucion key={inst.id} value={String(inst.id)}>{inst.nombre} · {inst.tipo}</OpcionInstitucion>
                            ))}
                          </MenuInstituciones>
                        </Select>
                        {avisoCampo("institucion")}
                      </div>
                      <div className="space-y-2">
                        <EtiquetaInstitucion htmlFor="sede">Sede *</EtiquetaInstitucion>
                        <Select value={newEvento.sede_id ?? ""} disabled={sedes.length === 0}
                          onValueChange={v => actualizarCampoAlta("sede", { sede_id: v })}>
                          <SelectorInstitucion id="sede" {...describirCampo("sede")}>
                            <SelectValue placeholder={sedes.length ? "Seleccionar sede" : newEvento.institucion_id ? "Sin sedes disponibles" : "Selecciona primero una institución"} />
                          </SelectorInstitucion>
                          <MenuInstituciones>
                            {sedes.map(sede => (
                              <OpcionInstitucion key={sede.id} value={String(sede.id)}>{sede.nombre}</OpcionInstitucion>
                            ))}
                          </MenuInstituciones>
                        </Select>
                        {avisoCampo("sede")}
                      </div>
                      {campoFecha}
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="institucion">Nombre de la Institución *</Label>
                        <Input id="institucion" value={newEvento.nombre_institucion}
                          onChange={e => setNewEvento({ ...newEvento, nombre_institucion: e.target.value })}
                          placeholder="Ej. Universidad Nacional" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="tipo">Tipo de Institución</Label>
                          <Select value={newEvento.tipo_institucion}
                            onValueChange={v => setNewEvento({ ...newEvento, tipo_institucion: v })}>
                            <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="universidad">Universidad</SelectItem>
                              <SelectItem value="colegio">Colegio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {campoFecha}
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="lugar">Lugar</Label>
                    <Input id="lugar" value={newEvento.lugar} maxLength={ensayoLaravel ? 255 : undefined}
                      {...describirCampo("lugar")}
                      onChange={e => actualizarCampoAlta("lugar", { lugar: e.target.value })}
                      placeholder="Ej. Auditorio Principal" />
                    {avisoCampo("lugar")}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numCer">Número de Ceremonias</Label>
                    <Select value={String(newEvento.numero_ceremonias)}
                      onValueChange={v => actualizarCampoAlta("numCer", { numero_ceremonias: Number(v) })}>
                      <SelectTrigger id="numCer" {...describirCampo("numCer")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} ceremonia{n > 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {avisoCampo("numCer")}
                  </div>
                </fieldset>
                {errorAlta && <p role="alert" className="rounded-md bg-error-suave p-3 text-sm text-error">{errorAlta}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" disabled={saving} onClick={() => setShowNew(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div> Creando...</>
                    ) : errorAlta && operacion.current ? 'Reintentar' : 'Crear Evento'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {eventosOrdenados.length === 0 ? (
          <Card className="border-dashed border-2 border-muted">
            <CardContent className="p-12 text-center">
              <CalendarDays className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Sin eventos registrados</h3>
              <p className="text-muted-foreground">Cree su primer evento de graduación</p>
            </CardContent>
          </Card>
        ) : (
          eventosOrdenados.map(evento => {
            const dias = evento.fecha ? diasRestantes(evento.fecha) : null;
            return (
              <Card key={evento.id} className="border-border/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                        <h3 className="text-lg font-bold text-foreground font-heading">{evento.nombre_institucion}</h3>
                        <Badge className={evento.tipo_institucion === 'universidad' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}>
                          {evento.tipo_institucion}
                        </Badge>
                        {dias !== null && (
                          <Badge className={
                            dias < 0 ? 'bg-muted text-muted-foreground' :
                            dias <= 7 ? 'bg-red-100 text-red-700' :
                            dias <= 30 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }>
                            {dias < 0 ? `Hace ${Math.abs(dias)} días` : dias === 0 ? 'Hoy' : `En ${dias} días`}
                          </Badge>
                        )}
                      </div>
                      {ensayoLaravel && <p className="mb-1 break-words text-sm text-muted-foreground">{evento.sede?.nombre ?? "Sede sin confirmar"}</p>}
                      <DatosEvento fecha={evento.fecha} lugar={evento.lugar} />
                      {ensayoLaravel ? (
                        <div className="mt-3 space-y-2">
                          <BotonEnsayo variant="outline" size="sm" aria-expanded={Boolean(abiertas[evento.id])}
                            aria-controls={`ceremonias-${evento.id}`} onClick={() => alternarCeremonias(evento.id)}>
                            {abiertas[evento.id] ? "Ocultar" : "Ver"} ceremonias ({evento.numero_ceremonias})
                          </BotonEnsayo>
                          {abiertas[evento.id] && (
                            <div id={`ceremonias-${evento.id}`}>
                              {estadoCeremonias[evento.id] === "cargando" ? (
                                <p role="status" className="text-sm text-muted-foreground">Cargando ceremonias…</p>
                              ) : estadoCeremonias[evento.id] ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <p role="alert" className="text-sm text-error">{estadoCeremonias[evento.id]}</p>
                                  <BotonEnsayo variant="outline" size="sm" onClick={() => cargarCeremonias(evento.id)}>Reintentar</BotonEnsayo>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {ceremonias[evento.id]?.length ? listaCeremonias(evento.id) : (
                                    <p className="text-sm text-muted-foreground">Sin ceremonias registradas.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (ceremonias[evento.id] || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">{listaCeremonias(evento.id)}</div>
                      )}
                    </div>
                    {!ensayoLaravel && (
                      <Button onClick={() => eliminarEvento(evento.id)} variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      {ensayoLaravel && errorCarga && <p role="alert" className="text-sm text-error">{errorCarga}</p>}
      {ensayoLaravel && hayMas && (
        <div className="flex justify-center">
          <BotonEnsayo variant="outline" onClick={cargarMas} disabled={cargandoMas}>
            {cargandoMas ? "Cargando…" : "Cargar más eventos"}
          </BotonEnsayo>
        </div>
      )}
    </div>
  );
}
