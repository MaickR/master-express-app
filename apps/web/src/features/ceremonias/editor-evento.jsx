import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorSesion } from "@/features/acceso/cliente-sesion";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { actualizarEvento, camposAlta, crearEvento, mensajeEventos } from "./cliente-eventos";

const formatoOperativo = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota", dateStyle: "short" });
export const fechaOperativa = (ahora = new Date()) => formatoOperativo.format(ahora);
const estiloSelector = "w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground min-h-11";

export function EditorEvento({ evento, catalogo, conectado, clave, alGuardar, alVencerSesion, children }) {
  const [abierto, setAbierto] = useState(false);
  const [institucion, setInstitucion] = useState("");
  const [sede, setSede] = useState("");
  const [errores, setErrores] = useState({});
  const [edicion, setEdicion] = useState(evento);
  const operacion = useRef(null);
  const procesando = useRef(false);
  const opciones = catalogo.data ?? [];
  const sedes = opciones.find(opcion => String(opcion.id) === institucion)?.sedes ?? [];
  const formulario = useRef(null);
  const consultaCliente = useQueryClient();
  const guardado = useMutation({
    mutationFn: datos => evento ? actualizarEvento(evento.id, datos) : crearEvento(datos),
    networkMode: "always",
    gcTime: 0,
  });

  function alternar(valor) {
    if (procesando.current) return;
    setAbierto(valor);
    if (valor) {
      setInstitucion("");
      setSede("");
      setErrores({});
      setEdicion(evento);
      guardado.reset();
    }
  }

  function marcar(campos) {
    setErrores(campos);
    formulario.current?.elements.namedItem(Object.keys(campos)[0])?.focus();
  }

  async function guardar(e) {
    e.preventDefault();
    if (!conectado || procesando.current) return;
    const datos = new FormData(e.currentTarget);
    const leer = campo => String(datos.get(campo) ?? "").trim();
    const fecha = leer("fecha");
    const instante = new Date(fecha + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(instante.getTime()) || instante.toISOString().slice(0, 10) !== fecha) {
      marcar({ fecha: "Ingresa una fecha válida." });
      return;
    }
    if (fecha < fechaOperativa()) {
      marcar({ fecha: "Selecciona hoy o una fecha futura en Colombia." });
      return;
    }
    if (!e.currentTarget.reportValidity()) return;
    setErrores({});
    let entrada = { fecha, lugar: leer("lugar") || null };
    if (evento) {
      const ceremonias = edicion.ceremonias.map(({ id }) => ({
        id, nombre: leer("nombre-" + id), hora: leer("hora-" + id) || null,
      }));
      const sinNombre = ceremonias.find(ceremonia => !ceremonia.nombre);
      if (sinNombre) {
        marcar({ ["nombre-" + sinNombre.id]: "Ingresa el nombre de la ceremonia." });
        return;
      }
      const previstos = leer("previstos");
      entrada = {
        ...entrada, revision: edicion.revision, ceremonias,
        graduandos_previstos: previstos === "" ? null : Number(previstos),
        responsable: leer("responsable") || null, observaciones: leer("observaciones") || null,
      };
    } else {
      const alta = { ...entrada, institucion_id: Number(institucion), sede_id: Number(sede), numero_ceremonias: Number(leer("numCer")) };
      const huella = JSON.stringify(alta);
      if (operacion.current && operacion.current.huella !== huella) {
        marcar({ general: "Ya se envió un intento sin confirmación. Revisa la lista y vuelve a ingresar los datos originales para reintentar." });
        return;
      }
      operacion.current ??= { huella, id: crypto.randomUUID() };
      entrada = { ...alta, operation_id: operacion.current.id };
    }
    procesando.current = true;
    try {
      const actualizado = await guardado.mutateAsync(entrada);
      operacion.current = null;
      setAbierto(false);
      alGuardar(actualizado, evento ? "Evento actualizado" : "Evento creado");
    } catch (error) {
      if (error instanceof ErrorSesion) {
        if (error.estado === 401) alVencerSesion();
        if (error.estado === 422) {
          operacion.current = null;
          const mensajes = { fecha: "Revisa la fecha operativa en Colombia.", institucion: "Selecciona una institución vigente.", sede: "Selecciona una sede de la institución.", lugar: "Ingresa un lugar de hasta 255 caracteres.", numCer: "Selecciona entre una y seis ceremonias." };
          const campos = error.campos.map(campo => camposAlta[campo]).filter(Boolean);
          marcar(Object.fromEntries(campos.map(campo => [campo, mensajes[campo]])));
        }
        if (error.estado === 409) {
          if (!evento) operacion.current = null;
          void consultaCliente.invalidateQueries({ queryKey: clave });
        }
      }
    } finally {
      procesando.current = false;
    }
  }

  const avisoCampo = nombre => errores[nombre] && <p id={nombre + "-error"} role="alert" className="text-sm text-error">{errores[nombre]}</p>;
  const atributos = nombre => errores[nombre] ? { "aria-invalid": true, "aria-describedby": nombre + "-error" } : {};

  return (
    <Dialog open={abierto} onOpenChange={alternar}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" />{evento ? "Editar evento" : "Nuevo evento de graduación"}</DialogTitle>
          <DialogDescription>{evento ? evento.institucion.nombre : "Selecciona la institución y la sede donde se realizará el evento."}</DialogDescription>
        </DialogHeader>
        {!evento && catalogo.isError && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-error">{mensajeEventos(catalogo.error)}</p>
            <Button variant="outline" type="button" onClick={() => catalogo.refetch()}>Volver a cargar instituciones</Button>
          </div>
        )}
        <form ref={formulario} className="space-y-4" noValidate onSubmit={guardar}>
          <fieldset disabled={guardado.isPending} className="min-w-0 space-y-4">
            {!evento && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="institucion">Institución</Label>
                  <select required id="institucion" name="institucion" className={estiloSelector} value={institucion} {...atributos("institucion")}
                    onChange={e => { setInstitucion(e.target.value); setSede(""); }}>
                    <option value="">{catalogo.isPending ? "Cargando instituciones…" : "Selecciona una institución"}</option>
                    {opciones.map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
                  </select>
                  {!catalogo.isPending && !catalogo.isError && opciones.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay instituciones disponibles para programar.</p>}
                  {avisoCampo("institucion")}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sede">Sede</Label>
                  <select required id="sede" name="sede" className={estiloSelector} value={sede} disabled={!institucion || sedes.length === 0}
                    onChange={e => setSede(e.target.value)} {...atributos("sede")}>
                    <option value="">{institucion && sedes.length === 0 ? "Sin sedes disponibles" : "Selecciona una sede"}</option>
                    {sedes.map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
                  </select>
                  {avisoCampo("sede")}
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label htmlFor="fecha">Fecha en Colombia</Label>
              <Input id="fecha" name="fecha" required type="date" min={fechaOperativa()} defaultValue={edicion?.fecha} {...atributos("fecha")} />
              {avisoCampo("fecha")}
            </div>
            <div className="space-y-1">
              <Label htmlFor="lugar">Lugar</Label>
              <Input id="lugar" name="lugar" maxLength={255} defaultValue={edicion?.lugar ?? ""} {...atributos("lugar")} />
              {avisoCampo("lugar")}
            </div>
            {evento ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="previstos">Graduandos previstos</Label>
                  <Input id="previstos" name="previstos" type="number" min={0} max={4294967295} defaultValue={edicion.graduandos_previstos ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="responsable">Responsable</Label>
                  <Input id="responsable" name="responsable" maxLength={120} defaultValue={edicion.responsable ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="observaciones">Observaciones de operación</Label>
                  <Textarea id="observaciones" name="observaciones" maxLength={2000} defaultValue={edicion.observaciones ?? ""} />
                </div>
                {edicion.ceremonias.map(ceremonia => (
                  <fieldset key={ceremonia.id} className="min-w-0 space-y-2 rounded-md border border-border p-3">
                    <legend className="px-1 text-sm font-semibold">Ceremonia {ceremonia.orden}</legend>
                    <Label htmlFor={"nombre-" + ceremonia.id}>Nombre</Label>
                    <Input id={"nombre-" + ceremonia.id} name={"nombre-" + ceremonia.id} required maxLength={255} defaultValue={ceremonia.nombre}
                      {...atributos("nombre-" + ceremonia.id)} />
                    {avisoCampo("nombre-" + ceremonia.id)}
                    <Label htmlFor={"hora-" + ceremonia.id}>Hora</Label>
                    <Input id={"hora-" + ceremonia.id} name={"hora-" + ceremonia.id} type="time" defaultValue={ceremonia.hora?.slice(0, 5) ?? ""} />
                  </fieldset>
                ))}
              </>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="numCer">Número de ceremonias</Label>
                <select id="numCer" name="numCer" className={estiloSelector} {...atributos("numCer")}>
                  {[1, 2, 3, 4, 5, 6].map(numero => <option key={numero} value={numero}>{numero}</option>)}
                </select>
                {avisoCampo("numCer")}
              </div>
            )}
          </fieldset>
          {(!conectado || errores.general || guardado.isError) && (
            <p role="alert" className="rounded-md bg-error-suave p-3 text-sm text-error">
              {!conectado ? "Recupera la conexión para guardar el evento." : errores.general || mensajeEventos(guardado.error)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={guardado.isPending} onClick={() => alternar(false)}>Cerrar</Button>
            <Button type="submit" className="min-h-11" disabled={guardado.isPending || !conectado || (!evento && !sede)}>
              {guardado.isPending ? "Guardando…" : evento ? "Guardar cambios" : "Crear evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
