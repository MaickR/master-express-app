import type { ComponentType, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes } from 'react';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { MoreHorizontal, Pencil, KeyRound, Mail, ShieldOff, ShieldCheck, LogOut, UserCog } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent as MenuContenido, DropdownMenuItem as MenuElemento } from '@/shared/ui/dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card as CardBase, CardContent as CardContentBase, CardHeader as CardHeaderBase, CardTitle as CardTitleBase } from '@/shared/ui/card';
import { Input as InputBase } from '@/shared/ui/input';
import { Label as LabelBase } from '@/shared/ui/label';
import { Dialog, DialogContent as ContenidoDialogo, DialogHeader as EncabezadoDialogo, DialogTitle as TituloDialogo, DialogDescription as DescripcionDialogo } from '@/shared/ui/dialog';
import { consultarAuditoria, cambiarPersonal, leerFormulario, errorPersonal, rolesPersonal } from './cliente-personal';
import { buttonVariants } from '@/shared/ui/button';
import { useSesion } from '@/features/acceso/contexto-sesion';
import { consultarCuentas, ErrorSesion, mensajeSesion } from '@/features/acceso/cliente-sesion';
const Card = CardBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const CardHeader = CardHeaderBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const CardTitle = CardTitleBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const CardContent = CardContentBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const Input = InputBase as ComponentType<InputHTMLAttributes<HTMLInputElement>>;
const Label = LabelBase as ComponentType<LabelHTMLAttributes<HTMLLabelElement>>;
const DialogContent = ContenidoDialogo as ComponentType<import('@radix-ui/react-dialog').DialogContentProps>;
const DialogHeader = EncabezadoDialogo as ComponentType<HTMLAttributes<HTMLDivElement>>;
const DialogTitle = TituloDialogo as ComponentType<HTMLAttributes<HTMLHeadingElement>>;
const DialogDescription = DescripcionDialogo as ComponentType<HTMLAttributes<HTMLParagraphElement>>;

const DropdownMenuContent = MenuContenido as ComponentType<import('@radix-ui/react-dropdown-menu').DropdownMenuContentProps>;
const DropdownMenuItem = MenuElemento as ComponentType<import('@radix-ui/react-dropdown-menu').DropdownMenuItemProps>;

const mensajes: Record<string, string> = {
  suspender: 'Cuenta suspendida y sesiones revocadas.',
  reactivar: 'Cuenta reactivada.',
  'revocar-sesiones': 'Sesiones revocadas.',
  recuperar: 'Solicitud de recuperación recibida.',
  editar: 'Nombre actualizado.',
  'cambiar-rol': 'Rol actualizado y sesiones revocadas.',
  'restablecer-clave': 'Contraseña temporal generada y sesiones revocadas.',
};
const estiloCampo = 'min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground';

function mensajeError(error: unknown): string {
  if (error instanceof ErrorSesion) {
    switch (error.estado) {
      case 403: return errorPersonal(error);
      case 404: return 'La cuenta interna ya no está disponible. Actualiza la lista.';
      case 409: return error.aviso || 'La cuenta está protegida.';
      case 422: return 'La acción de cuenta no es válida.';
    }
  }
  return mensajeSesion(error);
}

export default function GestionCuentasInternas({ actorId }: { actorId: number }) {
  const crearBoton = useRef<HTMLButtonElement>(null);
  const retornoFoco = useRef<HTMLElement | null>(null);
  const [formulario, setFormulario] = useState<{ id: number; nombre: string; roles: string[] } | 'crear'>();
  const [temporal, setTemporal] = useState('');
  const [manual, setManual] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<unknown>();
  const [buscar, setBuscar] = useState('');
  const [filtros, setFiltros] = useState({ q: '', rol: '', estado: '', acceso: '', desde: '', hasta: '' });
  useEffect(() => {
    const espera = window.setTimeout(() => {
      setFiltros(actual => ({ ...actual, q: buscar }));
      establecerPagina(1);
    }, 300);
    return () => window.clearTimeout(espera);
  }, [buscar]);
  const [paginaAuditoria, setPaginaAuditoria] = useState(1);
  const [verAuditoria, setVerAuditoria] = useState(false);
  const [pagina, establecerPagina] = useState(1);
  const [aviso, establecerAviso] = useState('');
  const cliente = useQueryClient();
  const { comprobar } = useSesion();
  const clave = ['cuentas-internas', actorId];
  const cuentas = useQuery({
    queryKey: [...clave, pagina, filtros],
    queryFn: ({ signal }) => consultarCuentas(pagina, signal, filtros),
    retry: false,
    enabled: !(filtros.desde && filtros.hasta && filtros.hasta < filtros.desde),
  });
  const auditoria = useQuery({
    queryKey: ['auditoria-cuentas', actorId, paginaAuditoria],
    queryFn: ({ signal }) => consultarAuditoria(paginaAuditoria, signal), enabled: verAuditoria, retry: false,
  });
  async function guardar(id: number | null, datos: Record<string, string>) {
    if (ocupado) return;
    setOcupado(true);
    setError(undefined);
    establecerAviso('');
    try {
      const ruta = '/api/administracion/cuentas' + (id === null ? '' : '/' + id);
      const respuesta = await cambiarPersonal(ruta, datos, ['cuenta.nombre', 'cuenta.correo', 'cuenta.rol', 'cuenta.password', 'operacion.nombre', 'operacion.rol']);
      if (respuesta.status !== 204) {
        const resultado = await respuesta.json() as { data: { password_temporal?: string } };
        setTemporal(resultado.data.password_temporal ?? '');
      }
      setFormulario(undefined);
      establecerAviso(id === null ? 'Cuenta creada. El titular debe cambiar la contraseña temporal al ingresar.' : mensajes[datos.accion]);
      if (id === actorId && ['suspender', 'revocar-sesiones', 'cambiar-rol'].includes(datos.accion)) comprobar();
      await Promise.all([
        cliente.invalidateQueries({ queryKey: clave }),
        cliente.invalidateQueries({ queryKey: ['auditoria-cuentas'] }),
      ]);
    } catch (problema) {
      setError(problema);
    } finally {
      setOcupado(false);
    }
  }
  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = leerFormulario(evento.currentTarget);
    if (formulario === 'crear') {
      if (!manual) delete datos.password;
      void guardar(null, datos);
    } else if (formulario) {
      void guardar(formulario.id, { accion: 'editar', nombre: datos.nombre });
    }
  }
  function ejecutar(id: number, nombre: string, accion: string, rol?: string) {
    const confirmaciones: Record<string, string> = {
      suspender: 'suspender la cuenta y cerrar sus sesiones',
      reactivar: 'reactivar la cuenta',
      'revocar-sesiones': 'cerrar todas las sesiones',
      recuperar: 'solicitar un enlace de recuperación por correo',
      'restablecer-clave': 'generar una contraseña temporal y cerrar todas las sesiones',
      'cambiar-rol': 'cambiar el rol y cerrar todas las sesiones',
    };
    if (!window.confirm('¿Quieres ' + confirmaciones[accion] + ' de ' + nombre + '?')) return;
    void guardar(id, { accion, ...(rol ? { rol } : {}) });
  }

  const erroresCampo = error instanceof ErrorSesion ? error.campos : [];
  const altaDisponible = cuentas.data?.alta_disponible !== false;
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.hasta < filtros.desde);
  return (
    <section aria-label="Gestión de cuentas internas" className="space-y-4 [&_button]:min-h-11">
      <div className="portal-encabezado"><h1 tabIndex={-1}>Cuentas internas</h1><p>Administra las cuentas y el acceso del personal.</p></div>
      <p className="text-sm text-muted-foreground">Administrador y Colaborador tienen acceso. Vendedor, Finanzas e Inventario están pendientes de portal y permisos operativos.</p>
      <div className="flex flex-wrap gap-2">
        <button ref={crearBoton} type="button" disabled={!altaDisponible} className={buttonVariants()} onClick={() => { retornoFoco.current = crearBoton.current; setError(undefined); setManual(false); setFormulario('crear'); }}>Crear cuenta interna</button>
        <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => setVerAuditoria(!verAuditoria)}>{verAuditoria ? 'Ocultar auditoría' : 'Consultar auditoría'}</button>
      </div>
      {!altaDisponible && <p role="status" className="text-sm text-muted-foreground">El alta con contraseña temporal todavía no está disponible.</p>}
      <Dialog open={Boolean(formulario)} onOpenChange={abierta => { if (!abierta && !ocupado) setFormulario(undefined); }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto" onCloseAutoFocus={evento => {
          evento.preventDefault();
          if (!document.querySelector('output')) retornoFoco.current?.focus();
        }}>
          <DialogHeader>
            <DialogTitle>{formulario === 'crear' ? 'Crear cuenta interna' : 'Editar nombre'}</DialogTitle>
            <DialogDescription>{formulario === 'crear' ? 'Usa el correo del titular. Podrá iniciar sesión con la contraseña temporal.' : 'El cambio se aplica al nombre que aparece en el panel.'}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4 [&_input]:min-h-11" onSubmit={enviar}>
            <div className="space-y-1">
              <Label htmlFor="crear-nombre">Nombre completo</Label>
              <Input id="crear-nombre" name="nombre" required maxLength={255} defaultValue={formulario && formulario !== 'crear' ? formulario.nombre : ''} />
              {erroresCampo.some(campo => campo.endsWith('.nombre')) && <p role="alert" className="text-sm text-destructive">Ingresa un nombre válido.</p>}
            </div>
            {formulario === 'crear' && <>
              <div className="space-y-1">
                <Label htmlFor="crear-correo">Correo electrónico</Label>
                <Input id="crear-correo" name="correo" type="email" required maxLength={255} aria-invalid={erroresCampo.includes('cuenta.correo')} aria-describedby={erroresCampo.includes('cuenta.correo') ? 'crear-correo-error' : undefined} />
                {erroresCampo.includes('cuenta.correo') && <p id="crear-correo-error" role="alert" className="text-sm text-destructive">Usa un correo válido, disponible y sin identificadores reservados.</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="crear-rol">Rol</Label>
                <select id="crear-rol" name="rol" className={estiloCampo} defaultValue="colaborador">
                  {rolesPersonal.map(([codigo, etiqueta]) => <option key={codigo} value={codigo}>{etiqueta}</option>)}
                </select>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={evento => setManual(evento.target.checked)} /> Establecer la contraseña temporal manualmente</label>
              {manual && <div className="space-y-1">
                <Label htmlFor="crear-password">Contraseña temporal</Label>
                <Input id="crear-password" name="password" type="password" autoComplete="new-password" required minLength={12} aria-describedby="crear-password-ayuda" />
                <p id="crear-password-ayuda" className="text-sm text-muted-foreground">Desde 12 caracteres y hasta 72 bytes.</p>
              </div>}
              {!manual && <p className="text-sm text-muted-foreground">La contraseña se genera al crear la cuenta.</p>}
            </>}
            {Boolean(error) && <p role="alert" className="text-sm text-destructive">{erroresCampo.includes('cuenta.password') ? 'Revisa los requisitos de la contraseña temporal.' : mensajeError(error)}</p>}
            <button className={buttonVariants()} disabled={ocupado}>{ocupado ? 'Guardando…' : formulario === 'crear' ? 'Crear cuenta' : 'Guardar nombre'}</button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(temporal)} onOpenChange={abierta => { if (!abierta) setTemporal(''); }}>
        <DialogContent className="w-[calc(100%-2rem)]" onCloseAutoFocus={evento => { evento.preventDefault(); crearBoton.current?.focus(); }}>
          <DialogHeader><DialogTitle>Contraseña temporal</DialogTitle><DialogDescription>Compártela con el titular por un canal privado. Se muestra una sola vez.</DialogDescription></DialogHeader>
          <output className="block break-all rounded-md border bg-muted p-3 font-mono text-foreground">{temporal}</output>
          <button type="button" className={buttonVariants()} onClick={() => setTemporal('')}>Listo</button>
        </DialogContent>
      </Dialog>
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1 text-sm font-medium">Buscar por nombre o correo
          <Input className="min-h-11" type="search" maxLength={255} value={buscar} onChange={evento => setBuscar(evento.target.value)} />
        </label>
        {([
          ['rol', 'Rol', rolesPersonal],
          ['estado', 'Estado', [['activa', 'Activa'], ['suspendida', 'Suspendida']]],
          ['acceso', 'Acceso', [['disponible', 'Disponible'], ['no-disponible', 'No disponible']]],
        ] as const).map(([campo, etiqueta, opciones]) => <label key={campo} className="space-y-1 text-sm font-medium">{etiqueta}
          <select className={estiloCampo} value={filtros[campo]} onChange={evento => {
            setFiltros({ ...filtros, [campo]: evento.target.value }); establecerPagina(1);
          }}>
            <option value="">Todos</option>
            {opciones.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
        </label>)}
        {(['desde', 'hasta'] as const).map(campo => <label key={campo} className="space-y-1 text-sm font-medium">Creación {campo}
          <Input className="min-h-11 min-w-0" type="date" aria-invalid={rangoInvalido} value={filtros[campo]} onChange={evento => {
            setFiltros({ ...filtros, [campo]: evento.target.value }); establecerPagina(1);
          }} />
        </label>)}
        {rangoInvalido && <p role="alert" className="text-sm text-destructive sm:col-span-2">La fecha final debe ser igual o posterior a la inicial.</p>}
      </div>
      {Boolean(error) && !formulario && <p role="alert">{mensajeError(error)}</p>}
      {verAuditoria && <Card><CardHeader><CardTitle>Auditoría de cuentas</CardTitle></CardHeader><CardContent className="space-y-3">
        {auditoria.isPending && <p role="status">Cargando auditoría…</p>}
        {auditoria.isError && <p role="alert">{errorPersonal(auditoria.error)}</p>}
        <ul className="space-y-2 text-sm [overflow-wrap:anywhere]">{auditoria.data?.data.map(evento => <li key={evento.id} className="border-b pb-2">
          {evento.accion} · Cuenta #{evento.cuenta_id} · Actor #{evento.actor_id}<br /><time dateTime={evento.created_at}>{new Date(evento.created_at).toLocaleString('es-CO')}</time>
        </li>)}</ul>
        {auditoria.data?.data.length === 0 && <p>No hay operaciones registradas.</p>}
        <div className="flex flex-wrap items-center gap-2"><button className={buttonVariants({ variant: 'outline' })} disabled={paginaAuditoria === 1} onClick={() => setPaginaAuditoria(paginaAuditoria - 1)}>Auditoría anterior</button>
          <span>Página {paginaAuditoria}</span><button className={buttonVariants({ variant: 'outline' })} disabled={!auditoria.data?.hayMas} onClick={() => setPaginaAuditoria(paginaAuditoria + 1)}>Auditoría siguiente</button></div>
      </CardContent></Card>}
      {!rangoInvalido && cuentas.isPending && <p role="status">Cargando cuentas…</p>}
      {cuentas.isError && (
        <div className="space-y-2">
          <p role="alert">{mensajeError(cuentas.error)}</p>
          <button type="button" className={buttonVariants({ variant: 'outline' })}
            onClick={() => void cuentas.refetch()}>Actualizar lista</button>
        </div>
      )}
      <p role="status">{aviso || (ocupado ? 'Aplicando el cambio…' : '')}</p>
      {!rangoInvalido && !cuentas.isError && cuentas.data && (
        <>
          {cuentas.data.data.length === 0 && <p>No hay cuentas en esta página.</p>}
          <ul className="space-y-3">
            {cuentas.data.data.map(cuenta => (
              <li key={cuenta.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-medium">{cuenta.nombre}{cuenta.id === actorId && ' (tu cuenta)'}</p>
                  <p className="break-all text-sm text-muted-foreground">{cuenta.correo}</p>
                  <p className="text-sm">{cuenta.activa ? 'Activa' : 'Suspendida'} · {cuenta.roles.map(rol => rolesPersonal.find(([codigo]) => codigo === rol)?.[1] ?? rol).join(', ')}{cuenta.principal && ' · Principal protegida'}</p>
                  <p className="text-sm text-muted-foreground">{cuenta.acceso_disponible ? 'Acceso disponible' : 'Acceso no disponible'}{cuenta.cambio_clave_pendiente && ' · Cambio de contraseña pendiente'}{cuenta.creada_en && ' · Alta ' + cuenta.creada_en}</p>
                </div>
                {(!cuenta.principal || cuenta.id === actorId) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className={buttonVariants({ variant: 'outline' })} disabled={ocupado}
                        id={'acciones-cuenta-' + cuenta.id} aria-label={'Acciones de ' + cuenta.nombre} title="Acciones de cuenta">
                        <MoreHorizontal aria-hidden="true" size={18} /> Acciones
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 [&_[role=menuitem]]:min-h-11">
                      {!cuenta.principal && <DropdownMenuItem onSelect={() => { retornoFoco.current = document.getElementById('acciones-cuenta-' + cuenta.id); setError(undefined); setFormulario(cuenta); }}><Pencil size={16} aria-hidden="true" /> Editar nombre</DropdownMenuItem>}
                      {altaDisponible && !cuenta.principal && cuenta.id !== actorId && <DropdownMenuItem onSelect={() => ejecutar(cuenta.id, cuenta.nombre, 'restablecer-clave')}><KeyRound size={16} aria-hidden="true" /> Generar nueva temporal</DropdownMenuItem>}
                      <DropdownMenuItem onSelect={() => ejecutar(cuenta.id, cuenta.nombre, 'recuperar')}><Mail size={16} aria-hidden="true" /> Recuperar por correo</DropdownMenuItem>
                      {!cuenta.principal && <DropdownMenuItem onSelect={() => ejecutar(cuenta.id, cuenta.nombre, cuenta.activa ? 'suspender' : 'reactivar')}>
                        {cuenta.activa ? <ShieldOff size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />} {cuenta.activa ? 'Suspender' : 'Reactivar'}
                      </DropdownMenuItem>}
                      {cuenta.activa && <DropdownMenuItem onSelect={() => ejecutar(cuenta.id, cuenta.nombre, 'revocar-sesiones')}><LogOut size={16} aria-hidden="true" /> Revocar sesiones</DropdownMenuItem>}
                      {!cuenta.principal && rolesPersonal.filter(([codigo]) => cuenta.roles.length !== 1 || !cuenta.roles.includes(codigo)).map(([codigo, etiqueta]) => (
                        <DropdownMenuItem key={codigo} onSelect={() => ejecutar(cuenta.id, cuenta.nombre, 'cambiar-rol', codigo)}><UserCog size={16} aria-hidden="true" /> Asignar {etiqueta}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
          {(pagina > 1 || cuentas.data.hayMas) && (
            <nav aria-label="Páginas de cuentas" className="flex flex-wrap items-center gap-3">
              <button type="button" className={buttonVariants({ variant: 'outline' })}
                disabled={pagina === 1 || ocupado}
                onClick={() => establecerPagina(pagina - 1)}>Anterior</button>
              <span>Página {pagina}</span>
              <button type="button" className={buttonVariants({ variant: 'outline' })}
                disabled={!cuentas.data.hayMas || ocupado}
                onClick={() => establecerPagina(pagina + 1)}>Siguiente</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
