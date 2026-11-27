import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  anularVinculoGraduando, corregirVinculoGraduando, ErrorSesion, listarCuentasGraduando,
  listarGraduandosOperativos, mensajeSesion, vincularGraduando,
} from "@/features/acceso/cliente-sesion";

function fecha(valor) {
  if (!valor) return "Sin fecha";
  const momento = new Date(valor);
  return Number.isNaN(momento.getTime()) ? valor : new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium", timeStyle: "short",
  }).format(momento);
}

function normalizar(valor) {
  return valor.trim().toLocaleLowerCase("es-CO").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");
}

function avisosDeRevision(graduando, cuenta) {
  if (!graduando || !cuenta) return [];
  const avisos = [];
  if (normalizar(graduando.nombre_completo) !== normalizar(cuenta.nombre)) {
    avisos.push("El nombre de la cuenta y el del graduando no coinciden. La vinculación solo usa los identificadores que confirmes.");
  }
  if (graduando.homonimo) {
    avisos.push("Hay otro graduando con el mismo nombre. No se fusionan personas: el acceso queda en el identificador seleccionado.");
  }
  return avisos;
}

function motivoValido(valor) {
  const limpio = valor.trim();
  return limpio.length >= 12 && limpio.length <= 500 && /\p{L}/u.test(limpio);
}

function mensajeError(error) {
  if (error instanceof ErrorSesion) {
    if (error.aviso) return error.aviso;
    if (error.estado === 401) return "Tu sesión terminó. Inicia sesión de nuevo.";
    if (error.estado === 403) return "Tu cuenta no puede corregir esta vinculación.";
    if (error.estado === 404) return "El graduando o la cuenta ya no está disponible.";
    if (error.estado === 422) return "Revisa el motivo y los identificadores seleccionados.";
  }
  return mensajeSesion(error);
}

export default function VinculacionGraduandos() {
  const [pagina, establecerPagina] = useState(1);
  const [paginaCuentas, establecerPaginaCuentas] = useState(1);
  const [busqueda, establecerBusqueda] = useState("");
  const [busquedaCuenta, establecerBusquedaCuenta] = useState("");
  const [graduando, establecerGraduando] = useState(null);
  const [cuentaId, establecerCuentaId] = useState("");
  const [confirmar, establecerConfirmar] = useState(false);
  const [modo, establecerModo] = useState("vincular");
  const [motivo, establecerMotivo] = useState("");
  const [errorMotivo, establecerErrorMotivo] = useState("");
  const [anular, establecerAnular] = useState(null);
  const [resultado, establecerResultado] = useState(null);
  const cliente = useQueryClient();
  const lista = useQuery({
    queryKey: ["vinculos-graduandos", pagina],
    queryFn: ({ signal }) => listarGraduandosOperativos(pagina, signal),
    retry: false,
  });
  const cuentas = useQuery({
    queryKey: ["cuentas-graduando", paginaCuentas],
    queryFn: ({ signal }) => listarCuentasGraduando(paginaCuentas, signal),
    enabled: graduando !== null,
    retry: false,
  });
  const cerrarDialogos = async () => {
    establecerConfirmar(false);
    establecerAnular(null);
    establecerGraduando(null);
    establecerCuentaId("");
    establecerMotivo("");
    establecerErrorMotivo("");
    await cliente.invalidateQueries({ queryKey: ["vinculos-graduandos"] });
    await cliente.invalidateQueries({ queryKey: ["cuentas-graduando"] });
  };
  const correccion = useMutation({
    mutationFn: () => corregirVinculoGraduando(graduando.vinculo.id, Number(cuentaId), motivo.trim()),
    onSuccess: async (respuesta) => {
      establecerResultado({
        id: respuesta.data.id,
        cuenta: respuesta.data.cuenta,
        graduando: respuesta.data.graduando,
        decidida_en: respuesta.data.decidida_en,
        anterior: respuesta.anterior,
      });
      await cerrarDialogos();
    },
  });
  const anulacion = useMutation({
    mutationFn: () => anularVinculoGraduando(anular.vinculo.id, motivo.trim()),
    onSuccess: async (respuesta) => {
      establecerResultado({
        id: respuesta.data.id,
        anulado: true,
        cuenta: { id: respuesta.data.cuenta_id, nombre: respuesta.data.cuenta_nombre },
      });
      await cerrarDialogos();
    },
  });
    const vinculacion = useMutation({
    mutationFn: () => vincularGraduando(graduando.id, Number(cuentaId)),
    onSuccess: async (respuesta) => {
      establecerResultado(respuesta.data);
      await cerrarDialogos();
    },
  });
  const texto = busqueda.trim().toLocaleLowerCase("es-CO");
  const visibles = (lista.data?.data ?? []).filter(item => !texto || [
    item.nombre_completo, String(item.id),
  ].some(campo => campo.toLocaleLowerCase("es-CO").includes(texto)));
  const textoCuenta = busquedaCuenta.trim().toLocaleLowerCase("es-CO");
  const cuentasVisibles = (cuentas.data?.data ?? []).filter(item => !textoCuenta || [
    item.nombre, item.correo, String(item.id),
  ].some(campo => campo.toLocaleLowerCase("es-CO").includes(textoCuenta)));
  const cuenta = cuentasVisibles.find(item => String(item.id) === cuentaId)
    ?? (cuentas.data?.data ?? []).find(item => String(item.id) === cuentaId);
  const avisos = avisosDeRevision(graduando, cuenta);
  const ocupado = vinculacion.isPending || correccion.isPending || anulacion.isPending;
  const errorActivo = vinculacion.error || correccion.error || anulacion.error;

  function preparar(item, siguienteModo) {
    establecerModo(siguienteModo);
    establecerGraduando(item);
    establecerCuentaId("");
    establecerPaginaCuentas(1);
    establecerBusquedaCuenta("");
    establecerMotivo("");
    establecerErrorMotivo("");
    establecerConfirmar(false);
    vinculacion.reset();
    correccion.reset();
  }

  function pedirConfirmacion() {
    if (modo === "corregir" && !motivoValido(motivo)) {
      establecerErrorMotivo("Escribe el motivo con un texto claro de al menos 12 caracteres.");
      return;
    }
    establecerErrorMotivo("");
    establecerConfirmar(true);
  }

  function pedirAnulacion() {
    if (!motivoValido(motivo)) {
      establecerErrorMotivo("Escribe el motivo con un texto claro de al menos 12 caracteres.");
      return;
    }
    establecerErrorMotivo("");
    anulacion.mutate();
  }

  return (
    <section aria-label="Vinculación de graduandos" className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="font-heading text-xl">Vinculación de graduandos</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Relaciona una cuenta con rol Graduando y un graduando operativo mediante sus identificadores.
            Un nombre, correo, documento o teléfono parecido no concede acceso.
          </CardDescription>
        </CardHeader>
      </Card>

      <label className="grid max-w-md gap-1 text-sm font-medium" htmlFor="buscar-graduando-operativo">
        Buscar en esta página
        <input id="buscar-graduando-operativo" value={busqueda} onChange={evento => establecerBusqueda(evento.target.value)}
          placeholder="Nombre o identificador"
          className="h-11 rounded-md border border-input bg-background px-3 text-base" />
      </label>

      {(lista.isError || (errorActivo && !confirmar && !anular)) && (
        <p role="alert" className="text-sm text-destructive">{mensajeError(lista.error || errorActivo)}</p>
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {lista.isPending ? "Cargando graduandos…" : ""}
        {resultado?.anulado && !lista.isPending
          ? `La vinculación ${resultado.id} quedó anulada. La cuenta ${resultado.cuenta.id} ya no accede a ese graduando. Las inscripciones no se movieron.`
          : ""}
        {resultado && !resultado.anulado && !lista.isPending
          ? `La vinculación ${resultado.id} quedó activa. Cuenta ${resultado.cuenta.id} y graduando ${resultado.graduando.id}. Decisión: ${fecha(resultado.decidida_en)}${resultado.anterior ? `. La cuenta anterior ${resultado.anterior.cuenta_id} quedó sin ese acceso.` : ""}`
          : ""}
      </p>
      {lista.data && visibles.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay graduandos operativos para este filtro.</p>
      )}

      <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {visibles.map(item => (
          <li key={item.id}>
            <Card className="h-full shadow-none">
              <CardHeader className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="min-w-0 font-heading text-lg leading-snug [overflow-wrap:anywhere]">
                    {item.nombre_completo}
                  </CardTitle>
                  <Badge variant={item.vinculo ? "default" : "outline"}>{item.vinculo ? "Vinculada" : "Sin vínculo"}</Badge>
                </div>
                <CardDescription className="space-y-1 text-sm">
                  <span className="block">Identificador {item.id}</span>
                  {item.homonimo && <Badge variant="secondary">Nombre compartido</Badge>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
                {item.vinculo ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed [overflow-wrap:anywhere]">
                      {`Cuenta ${item.vinculo.cuenta_id}${item.vinculo.cuenta_nombre ? ` · ${item.vinculo.cuenta_nombre}` : ""}${item.vinculo.cuenta_correo ? ` · ${item.vinculo.cuenta_correo}` : ""}. Decidida el ${fecha(item.vinculo.decidida_en)}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" className="min-h-11 h-auto whitespace-normal" onClick={() => preparar(item, "corregir")}>
                        Corregir vínculo
                      </Button>
                      <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal"
                        onClick={() => { establecerAnular(item); establecerMotivo(""); establecerErrorMotivo(""); anulacion.reset(); }}>
                        Anular vínculo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" className="min-h-11 h-auto whitespace-normal" onClick={() => preparar(item, "vincular")}>
                    Vincular cuenta
                  </Button>
                )}
                {item.anteriores?.length > 0 && (
                  <ul className="space-y-2 border-t border-border pt-3 text-sm text-muted-foreground">
                    {item.anteriores.map(anterior => (
                      <li key={anterior.id} className="[overflow-wrap:anywhere]">
                        {`Vinculación ${anterior.id} anulada. Cuenta anterior ${anterior.cuenta_id}${anterior.cuenta_nombre ? ` · ${anterior.cuenta_nombre}` : ""}. ${fecha(anterior.anulado_en)}. ${anterior.motivo ?? ""}`}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={pagina === 1 || lista.isPending}
          onClick={() => establecerPagina(actual => Math.max(1, actual - 1))}>Anterior</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={!lista.data?.hayMas || lista.isPending}
          onClick={() => establecerPagina(actual => actual + 1)}>Siguiente</Button>
      </div>

      <Dialog open={graduando !== null} onOpenChange={abierto => { if (!abierto && !ocupado) establecerGraduando(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{modo === "corregir" ? "Corregir vinculación" : "Revisar identidades"}</DialogTitle>
            <DialogDescription>
              {modo === "corregir"
                ? "La cuenta anterior pierde el acceso al confirmar. Las inscripciones, ceremonias y pagos permanecen donde están."
                : "Elige una cuenta elegible y compara los identificadores. El servidor vuelve a autorizar la decisión."}
            </DialogDescription>
          </DialogHeader>
          {graduando && (
            <div className="space-y-4 text-sm">
              <p className="[overflow-wrap:anywhere]">
                <span className="font-medium text-foreground">Graduando {graduando.id}.</span>{" "}
                {graduando.nombre_completo}
              </p>
              {modo === "corregir" && graduando.vinculo && (
                <p className="rounded-md border border-border bg-muted p-3 [overflow-wrap:anywhere]">
                  {`Acceso actual: cuenta ${graduando.vinculo.cuenta_id}${graduando.vinculo.cuenta_nombre ? ` · ${graduando.vinculo.cuenta_nombre}` : ""}. Esta relación se anula al confirmar la cuenta nueva.`}
                </p>
              )}
              <label className="grid gap-1 font-medium" htmlFor="buscar-cuenta-graduando">
                Buscar cuenta en esta página
                <input id="buscar-cuenta-graduando" value={busquedaCuenta}
                  onChange={evento => establecerBusquedaCuenta(evento.target.value)}
                  placeholder="Nombre, correo o identificador"
                  className="h-11 rounded-md border border-input bg-background px-3 text-base font-normal" />
              </label>
              {cuentas.isPending && <p role="status">Cargando cuentas…</p>}
              {cuentas.isError && <p role="alert" className="text-destructive">{mensajeError(cuentas.error)}</p>}
              {cuentas.data && cuentasVisibles.length === 0 && (
                <p>No hay cuentas de Graduando elegibles en esta página. Una cuenta elegible está activa, tiene el correo verificado y todavía no tiene vinculación.</p>
              )}
              <fieldset className="space-y-2">
                <legend className="sr-only">Cuenta de Graduando</legend>
                {cuentasVisibles.map(item => (
                  <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                    <input className="mt-1 size-4" type="radio" name="cuenta-graduando" value={item.id}
                      checked={cuentaId === String(item.id)} onChange={() => establecerCuentaId(String(item.id))} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block font-medium">{item.nombre}</span>
                      <span className="block text-muted-foreground">{item.correo}</span>
                      <span className="block text-muted-foreground">Identificador {item.id}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {modo === "corregir" && (
                <label className="grid gap-1 font-medium" htmlFor="motivo-correccion">
                  Motivo de la corrección
                  <textarea id="motivo-correccion" value={motivo} onChange={evento => establecerMotivo(evento.target.value)}
                    required minLength={12} maxLength={500} rows={3}
                    className="rounded-md border border-input bg-background px-3 py-2 text-base font-normal" />
                  {errorMotivo && <span className="font-normal text-destructive">{errorMotivo}</span>}
                </label>
              )}
              {avisos.length > 0 && (
                <ul className="space-y-2 rounded-md border border-border bg-muted p-3 text-muted-foreground">
                  {avisos.map(aviso => <li key={aviso}>{aviso}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" disabled={paginaCuentas === 1 || cuentas.isPending}
                  onClick={() => establecerPaginaCuentas(actual => Math.max(1, actual - 1))}>Anterior</Button>
                <Button type="button" variant="outline" className="min-h-11" disabled={!cuentas.data?.hayMas || cuentas.isPending}
                  onClick={() => establecerPaginaCuentas(actual => actual + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" className="min-h-11" disabled={!cuenta || ocupado} onClick={pedirConfirmacion}>
              {modo === "corregir" ? "Revisar la corrección" : "Revisar y confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmar} onOpenChange={abierto => { if (!ocupado) establecerConfirmar(abierto); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{modo === "corregir" ? "Confirmar la corrección" : "Confirmar vinculación"}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 [overflow-wrap:anywhere]">
              <span className="block">
                Graduando {graduando?.id}: {graduando?.nombre_completo}. Cuenta {cuenta?.id}: {cuenta?.nombre} ({cuenta?.correo}).
              </span>
              {modo === "corregir" && (
                <span className="block">
                  {`La cuenta anterior ${graduando?.vinculo?.cuenta_id} deja de acceder a este graduando. Las inscripciones no se trasladan de ceremonia ni se borran.`}
                </span>
              )}
              {avisos.map(aviso => <span key={aviso} className="block">{aviso}</span>)}
              {modo === "vincular" && <span className="block">Esta acción no modifica inscripciones ni pagos.</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorActivo && <p role="alert" className="text-sm text-destructive">{mensajeError(errorActivo)}</p>}
          <p role="status" className="text-sm text-muted-foreground">{ocupado ? "Guardando la decisión…" : ""}</p>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={ocupado}>Volver</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" disabled={ocupado || !cuenta} onClick={evento => {
              evento.preventDefault();
              if (modo === "corregir") correccion.mutate();
              else vinculacion.mutate();
            }}>
              {modo === "corregir" ? "Confirmar corrección" : "Confirmar vinculación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={anular !== null} onOpenChange={abierto => { if (!abierto && !ocupado) establecerAnular(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular vinculación</AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {`La cuenta ${anular?.vinculo?.cuenta_id ?? ""} deja de acceder al graduando ${anular?.id ?? ""}. La fila y las inscripciones se conservan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-1 text-sm font-medium" htmlFor="motivo-anulacion">
            Motivo de la anulación
            <textarea id="motivo-anulacion" value={motivo} onChange={evento => establecerMotivo(evento.target.value)}
              required minLength={12} maxLength={500} rows={3}
              className="rounded-md border border-input bg-background px-3 py-2 text-base font-normal" />
            {errorMotivo && <span className="font-normal text-destructive">{errorMotivo}</span>}
          </label>
          {anulacion.isError && <p role="alert" className="text-sm text-destructive">{mensajeError(anulacion.error)}</p>}
          <p role="status" className="text-sm text-muted-foreground">{anulacion.isPending ? "Anulando la vinculación…" : ""}</p>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={ocupado}>Volver</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" disabled={ocupado} onClick={evento => {
              evento.preventDefault();
              pedirAnulacion();
            }}>
              Confirmar anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
