import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorSesion } from '@/features/acceso/cliente-sesion';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/shared/ui/dialog';
import { listarGraduandos, listarFiltrosGraduandos, consultarGraduando, guardarGraduando, listarInscripciones, listarProgramacion,
  inscribirGraduando, mensajeGraduandos, type DatosGraduando, type PerfilGraduando } from './cliente-graduandos';

const EncabezadoDialogo = DialogHeader as ComponentType<ComponentProps<'div'>>;
const TituloDialogo = DialogTitle as ComponentType<ComponentProps<'h2'>>;
const DescripcionDialogo = DialogDescription as ComponentType<ComponentProps<'p'>>;
const ContenidoDialogo = DialogContent as ComponentType<ComponentProps<'div'> & { children: ReactNode; onCloseAutoFocus?: (evento: Event) => void }>;
const estiloCampo = 'min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base';
const vacio: DatosGraduando = { nombre_completo: '', tipo_documento: '', numero_documento: '', correo: '', telefono: '' };

export default function GestionGraduandos({ actorId, lectura = false }: { actorId: number; lectura?: boolean }) {
  const [pagina, cambiarPagina] = useState(1);
  const [filtros, cambiarFiltros] = useState<Record<string, string>>({});
  const [seleccion, seleccionar] = useState<PerfilGraduando | null>(null);
  const [editar, cambiarEditar] = useState(false);
  const [datos, cambiarDatos] = useState<DatosGraduando>(vacio);
  const [abierto, cambiarAbierto] = useState(false);
  const [confirmado, confirmar] = useState(false);
  const [conectado, conectar] = useState(navigator.onLine);
  const [paginaRegistros, cambiarPaginaRegistros] = useState(1);
  const [paginaEventos, cambiarPaginaEventos] = useState(1);
  const [evento, cambiarEvento] = useState('');
  const [ceremonia, cambiarCeremonia] = useState('');
  const [programa, cambiarPrograma] = useState('');
  const [aviso, cambiarAviso] = useState('');
  const activador = useRef<HTMLElement | null>(null);
  const operacion = useRef('');
  const operacionInscripcion = useRef('');
  const cliente = useQueryClient();
  const clave = ['gestion-graduandos', actorId];
  useEffect(() => {
    const actualizar = () => conectar(navigator.onLine);
    window.addEventListener('online', actualizar); window.addEventListener('offline', actualizar);
    return () => { window.removeEventListener('online', actualizar); window.removeEventListener('offline', actualizar); };
  }, []);
  const opciones = { retry: false, gcTime: 0, refetchOnWindowFocus: 'always' as const, refetchOnReconnect: 'always' as const };
  const lista = useQuery({ queryKey: [...clave, 'lista', pagina, filtros], queryFn: ({ signal }) => listarGraduandos(pagina, filtros, signal), ...opciones });
  const catalogo = useQuery({ queryKey: [...clave, 'filtros'], queryFn: ({ signal }) => listarFiltrosGraduandos(signal), ...opciones });
  const detalle = useQuery({ queryKey: [...clave, 'detalle', seleccion?.id], queryFn: ({ signal }) => consultarGraduando(seleccion!.id, signal), enabled: abierto && !!seleccion, ...opciones });
  const registros = useQuery({ queryKey: [...clave, 'inscripciones', seleccion?.id, paginaRegistros], queryFn: ({ signal }) => listarInscripciones(seleccion!.id, paginaRegistros, signal), enabled: abierto && !!seleccion && !editar, ...opciones });
  const programacion = useQuery({ queryKey: [...clave, 'programacion', paginaEventos], queryFn: ({ signal }) => listarProgramacion(paginaEventos, signal), enabled: abierto && !!seleccion?.puede_editar && !editar && !lectura, ...opciones });
  async function invalidar() {
    await cliente.invalidateQueries({ queryKey: clave });
    await cliente.invalidateQueries({ queryKey: ['vinculos-graduandos'] });
    await cliente.invalidateQueries({ queryKey: ['programacion'] });
  }
  const guardar = useMutation({ mutationFn: () => guardarGraduando(datos, operacion.current, seleccion), onError: (error) => {
    if (error instanceof ErrorSesion && error.campos.length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    }
  }, onSuccess: async () => {
    cambiarAbierto(false); cambiarAviso('El perfil quedó guardado.'); await invalidar();
  } });
  const inscribir = useMutation({ mutationFn: () => inscribirGraduando(seleccion!.id, Number(evento), Number(ceremonia), programa, operacionInscripcion.current),
    onSuccess: async () => { cambiarAviso('La inscripción quedó confirmada.'); confirmar(false); await invalidar(); } });
  const ocupado = guardar.isPending || inscribir.isPending;
  function abrir(fila: PerfilGraduando | null, edicion: boolean, origen?: HTMLElement) {
    activador.current = origen ?? document.activeElement as HTMLElement;
    seleccionar(fila); cambiarEditar(edicion); cambiarDatos(fila ? { nombre_completo: fila.nombre_completo,
      tipo_documento: fila.tipo_documento ?? '', numero_documento: fila.numero_documento ?? '', correo: fila.correo ?? '', telefono: fila.telefono ?? '' } : vacio);
    operacion.current = crypto.randomUUID(); operacionInscripcion.current = crypto.randomUUID();
    cambiarEvento(''); cambiarCeremonia(''); cambiarPrograma(''); cambiarPaginaRegistros(1); cambiarPaginaEventos(1);
    guardar.reset(); inscribir.reset(); confirmar(false); cambiarAviso(''); cambiarAbierto(true);
  }
  function filtrar(campo: string, valor: string) {
    cambiarFiltros(previo => {
      const nuevos = { ...previo, [campo]: valor };
      if (campo === 'institucion_id') { nuevos.sede_id = ''; nuevos.evento_id = ''; nuevos.ceremonia_id = ''; }
      if (campo === 'sede_id') { nuevos.evento_id = ''; nuevos.ceremonia_id = ''; }
      if (campo === 'evento_id') nuevos.ceremonia_id = '';
      return nuevos;
    }); cambiarPagina(1);
  }
  const eventosFiltro = (catalogo.data?.data ?? []).filter(fila => (!filtros.institucion_id || fila.institucion.id === Number(filtros.institucion_id))
    && (!filtros.sede_id || fila.sede?.id === Number(filtros.sede_id)));
  const unicas = (opciones: Array<{ id: number; nombre: string }>) => [...new Map(opciones.map(fila => [fila.id, fila])).values()];
  const opcionesFiltro = {
    institucion_id: unicas((catalogo.data?.data ?? []).map(fila => fila.institucion)),
    sede_id: unicas((catalogo.data?.data ?? []).filter(fila => !filtros.institucion_id || fila.institucion.id === Number(filtros.institucion_id)).flatMap(fila => fila.sede ? [fila.sede] : [])),
    evento_id: eventosFiltro,
    ceremonia_id: eventosFiltro.filter(fila => !filtros.evento_id || fila.id === Number(filtros.evento_id)).flatMap(fila => fila.ceremonias),
  };
  const invalido = (campo: keyof DatosGraduando) => guardar.error instanceof ErrorSesion && guardar.error.campos.includes('graduando.' + campo);
  const erroresCampo = (campo: keyof DatosGraduando) => ({ 'aria-invalid': invalido(campo) || undefined, 'aria-describedby': invalido(campo) ? 'error-perfil-graduando' : undefined });
  const datosLista = lista.isError ? undefined : lista.data;
  const datosRegistros = registros.isError ? undefined : registros.data;
  const actual = detalle.data?.data ?? seleccion;
  return <section aria-label="Gestión de graduandos" className="space-y-4 [overflow-wrap:anywhere]">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Graduandos e inscripciones</h2>
      {!lectura && <button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={!conectado} onClick={evento => abrir(null, true, evento.currentTarget)}>Registrar graduando</button>}</header>
    <p className="text-sm text-muted-foreground">El perfil operativo y la cuenta de acceso se gestionan por separado. Las inscripciones no confirman ventas ni pagos.</p>
    {!conectado && <p role="status" className="rounded-md border border-border bg-muted p-3">Sin conexión. Los datos visibles pueden estar desactualizados. Conéctate para guardar o confirmar inscripciones.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="grid gap-1 text-sm font-medium">Buscar graduando<input className={estiloCampo} value={filtros.buscar ?? ''} maxLength={150} id="gestion-buscar-graduando" placeholder="Nombre, documento o correo" onChange={e => filtrar('buscar', e.target.value)} /></label>
      <label className="grid gap-1 text-sm font-medium">Estado de vinculación<select className={estiloCampo} value={filtros.vinculacion ?? ''} onChange={e => filtrar('vinculacion', e.target.value)}><option value="">Todos</option><option value="activa">Con vínculo activo</option><option value="sin_vinculo">Sin vínculo activo</option></select></label>
      {(['institucion_id', 'sede_id', 'evento_id', 'ceremonia_id'] as const).map((campo, indice) => <label className="grid gap-1 text-sm font-medium" key={campo}>{['Institución', 'Sede', 'Evento', 'Ceremonia'][indice]}<select className={estiloCampo} value={filtros[campo] ?? ''} onChange={e => filtrar(campo, e.target.value)}><option value="">Todas las opciones autorizadas</option>{opcionesFiltro[campo].map(fila => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}</select></label>)}
    </div>
    {lista.isPending && <p role="status">Consultando graduandos…</p>}
    {lista.isError && <div role="alert"><p>{mensajeGraduandos(lista.error)}</p><button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void lista.refetch()}>Volver a intentar</button></div>}
    {aviso && <p role="status">{aviso}</p>}
    {datosLista && <p className="text-sm text-muted-foreground">{datosLista.total} graduandos · Página {pagina}{lista.isFetching ? ' · Actualizando…' : ''}</p>}
    {datosLista?.data.length === 0 && <p>No hay graduandos para estos filtros.</p>}
    <ul className="grid gap-3 lg:grid-cols-2">{datosLista?.data.map(fila => <li key={fila.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold">{fila.nombre_completo}</h3><p className="text-sm text-muted-foreground">Identificador {fila.id} · {fila.vinculado ? 'Cuenta vinculada' : 'Sin cuenta vinculada'}</p>
      <p className="text-sm">{fila.tipo_documento ? `${fila.tipo_documento} ${fila.numero_documento}` : 'Documento no registrado'}{fila.correo && ` · ${fila.correo}`}</p>
      <div className="flex flex-wrap gap-2"><button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" onClick={evento => abrir(fila, false, evento.currentTarget)}>Ver detalle</button>
      {!lectura && fila.puede_editar && <button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={!conectado} onClick={evento => abrir(fila, true, evento.currentTarget)}>Editar perfil</button>}</div></li>)}</ul>
    <div className="flex flex-wrap gap-2"><button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={pagina === 1 || lista.isFetching} onClick={() => cambiarPagina(pagina - 1)}>Anterior</button><button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={!datosLista?.hayMas || lista.isFetching} onClick={() => cambiarPagina(pagina + 1)}>Siguiente</button></div>
    <Dialog open={abierto} onOpenChange={(valor: boolean) => { if (!ocupado) cambiarAbierto(valor); }}>
      <ContenidoDialogo onCloseAutoFocus={evento => { evento.preventDefault(); (activador.current?.isConnected ? activador.current : document.getElementById('gestion-buscar-graduando'))?.focus(); }} aria-busy={ocupado} className="max-h-[90dvh] min-w-0 overflow-y-auto [overflow-wrap:anywhere] [&>*]:min-w-0 sm:max-w-2xl">
        <EncabezadoDialogo><TituloDialogo>{editar ? seleccion ? 'Editar perfil operativo' : 'Registrar graduando' : 'Detalle del graduando'}</TituloDialogo><DescripcionDialogo>Los históricos se conservan. Revisa la identidad antes de confirmar.</DescripcionDialogo></EncabezadoDialogo>
        {editar ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (confirmado && conectado && !ocupado) guardar.mutate(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">Nombre completo<input autoFocus className={estiloCampo} required maxLength={255} {...erroresCampo('nombre_completo')} value={datos.nombre_completo} onChange={e => cambiarDatos({ ...datos, nombre_completo: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Tipo de documento<select className={estiloCampo} {...erroresCampo('tipo_documento')} value={datos.tipo_documento} onChange={e => cambiarDatos({ ...datos, tipo_documento: e.target.value, numero_documento: '' })}><option value="">Sin documento</option><option value="CC">Cédula de ciudadanía</option><option value="TI">Tarjeta de identidad</option></select></label>
            <label className="grid gap-1 text-sm font-medium">Número de documento<input className={estiloCampo} disabled={!datos.tipo_documento} required={!!datos.tipo_documento} inputMode="numeric" pattern="[0-9]{1,30}" maxLength={30} {...erroresCampo('numero_documento')} value={datos.numero_documento} onChange={e => cambiarDatos({ ...datos, numero_documento: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Correo<input className={estiloCampo} type="email" maxLength={254} {...erroresCampo('correo')} value={datos.correo} onChange={e => cambiarDatos({ ...datos, correo: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Teléfono<input className={estiloCampo} type="tel" pattern="[0-9]{7,15}" maxLength={15} {...erroresCampo('telefono')} value={datos.telefono} onChange={e => cambiarDatos({ ...datos, telefono: e.target.value })} /></label>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required checked={confirmado} onChange={e => confirmar(e.target.checked)} />Confirmé la identidad. Un nombre o correo coincidente requiere revisión y no fusiona personas.</label>
          {guardar.isError && <p id="error-perfil-graduando" role="alert" className="text-destructive">{mensajeGraduandos(guardar.error)}</p>}
          <button type="submit" className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={ocupado || !conectado || !confirmado}>{guardar.isPending ? 'Guardando…' : 'Guardar perfil'}</button>
        </form> : <div className="space-y-4">
          {detalle.isError ? <p role="alert">{mensajeGraduandos(detalle.error)}</p> : <><h3 className="font-semibold">{actual?.nombre_completo}</h3><p>{actual?.tipo_documento} {actual?.numero_documento}</p><p>{actual?.correo || 'Sin correo'} · {actual?.telefono || 'Sin teléfono'}</p></>}
          <h3 className="font-semibold">Inscripciones autorizadas</h3>
          {registros.isPending && <p role="status">Consultando inscripciones…</p>}
          {registros.isError && <p role="alert">{mensajeGraduandos(registros.error)}</p>}
          {datosRegistros?.data.length === 0 && <p>No hay inscripciones autorizadas.</p>}
          <ul className="space-y-2">{datosRegistros?.data.map(fila => <li key={fila.id} className="rounded-md border border-border p-3">Inscripción {fila.id} · Evento {fila.evento_id} · Ceremonia {fila.ceremonia_id}<span className="block text-sm text-muted-foreground">{fila.programa_academico || 'Sin programa académico'}</span></li>)}</ul>
          <div className="flex flex-wrap gap-2"><button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={paginaRegistros === 1 || registros.isFetching} onClick={() => cambiarPaginaRegistros(paginaRegistros - 1)}>Inscripciones anteriores</button><button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={!datosRegistros?.links.next || registros.isFetching} onClick={() => cambiarPaginaRegistros(paginaRegistros + 1)}>Más inscripciones</button></div>
          {!lectura && actual?.puede_editar && !detalle.isError && <form className="space-y-3 border-t border-border pt-4" onSubmit={e => { e.preventDefault(); if (confirmado && conectado && !ocupado) inscribir.mutate(); }}>
            <h3 className="font-semibold">Inscribir en ceremonia</h3>
            {programacion.isError && <p role="alert">{mensajeGraduandos(programacion.error)}</p>}
            <label className="grid gap-1 text-sm font-medium">Evento disponible<select className={estiloCampo} required value={evento} onChange={e => { cambiarEvento(e.target.value); cambiarCeremonia(''); confirmar(false); operacionInscripcion.current = crypto.randomUUID(); inscribir.reset(); }}><option value="">Selecciona un evento</option>{programacion.data?.data.map(fila => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}</select></label>
            <div className="flex flex-wrap gap-2"><button type="button" className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={paginaEventos === 1} onClick={() => cambiarPaginaEventos(paginaEventos - 1)}>Eventos anteriores</button><button type="button" className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={!programacion.data?.hayMas} onClick={() => cambiarPaginaEventos(paginaEventos + 1)}>Más eventos</button></div>
            <label className="grid gap-1 text-sm font-medium">Ceremonia<select className={estiloCampo} required value={ceremonia} onChange={e => { cambiarCeremonia(e.target.value); confirmar(false); operacionInscripcion.current = crypto.randomUUID(); }}><option value="">Selecciona una ceremonia</option>{programacion.data?.data.find(fila => fila.id === Number(evento))?.ceremonias.map(fila => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-medium">Programa académico (opcional)<input className={estiloCampo} maxLength={255} value={programa} onChange={e => { cambiarPrograma(e.target.value); confirmar(false); operacionInscripcion.current = crypto.randomUUID(); }} /></label>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required checked={confirmado} onChange={e => confirmar(e.target.checked)} />Confirmo el graduando y la ceremonia seleccionados.</label>
            {inscribir.isError && <p role="alert" className="text-destructive">{mensajeGraduandos(inscribir.error)}</p>}
            <button className="panel-accion disabled:cursor-not-allowed disabled:opacity-50" disabled={!conectado || ocupado || !confirmado || !evento || !ceremonia}>{inscribir.isPending ? 'Confirmando…' : 'Confirmar inscripción'}</button>
            {aviso && <p role="status">{aviso}</p>}
          </form>}
        </div>}
      </ContenidoDialogo>
    </Dialog>
  </section>;
}
