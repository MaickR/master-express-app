import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, ChevronDown, ChevronRight, LogOut, Menu, UserRound } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { useSesion } from "@/features/acceso/contexto-sesion";
import SelectorTema from "@/shared/components/selector-tema";

/**
 * @typedef {{ id: string, label: string, icon: import("lucide-react").LucideIcon, url?: string }} Destino
 * @typedef {{ id: string, label?: string, destinos: Destino[] }} Grupo
 */

/** @param {{ grupos: Grupo[], activo: string, alSeleccionar?: (id: string) => void, alCerrar?: (id: string) => void }} props */
function NavegacionPanel({ grupos, activo, alSeleccionar, alCerrar }) {
  return (
    <nav aria-label="Navegación del panel" className="panel-navegacion">
      {grupos.map(grupo => (
        <div key={grupo.id}>
          {grupo.label && <p className="panel-navegacion__grupo">{grupo.label}</p>}
          <ul className="space-y-1">
            {grupo.destinos.map(({ id, label, icon: Icono, url }) => {
              const actual = id === activo ? "page" : undefined;
              const contenido = (
                <>
                  <Icono aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{label}</span>
                  {actual && <ChevronRight aria-hidden="true" className="size-4 shrink-0" />}
                </>
              );
              return (
                <li key={id}>
                  {url ? (
                    <Link to={url} aria-current={actual} onClick={() => alCerrar?.(id)} className="panel-navegacion__destino">
                      {contenido}
                    </Link>
                  ) : (
                    <button type="button" aria-current={actual} className="panel-navegacion__destino"
                      onClick={() => { alSeleccionar?.(id); alCerrar?.(id); }}>
                      {contenido}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function MarcaPanel() {
  return (
    <div className="panel-marca">
      <img src="/master-express.png" alt="" width="44" height="44" />
      <span>MasterExpress <strong>Control</strong></span>
    </div>
  );
}

/**
 * @param {{
 *   grupos: Grupo[], activo: string, rol: string, nombre: string,
 *   alSeleccionar?: (id: string) => void, avatar?: React.ReactNode, alAbrirPerfil?: () => void,
 *   children: React.ReactNode
 * }} props
 */
export default function PanelOperativo({ grupos, activo, rol, nombre, alSeleccionar, avatar, alAbrirPerfil, children }) {
  const navegar = useNavigate();
  const { estado, cerrar } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const activadorMenu = useRef(null);
  const activadorCuenta = useRef(null);
  const contenido = useRef(null);
  const enfocarAlCerrarMenu = useRef(false);
  const enfocarAlCerrarCuenta = useRef(false);
  const seccion = grupos.flatMap(grupo => grupo.destinos).find(destino => destino.id === activo)?.label || rol;
  const nombreVisible = nombre?.trim() || rol;
  const iniciales = nombreVisible.split(/\s+/).slice(0, 2).map(parte => parte.charAt(0)).join("").toUpperCase();
  const variosRoles = estado.tipo === "autenticado" && new Set(estado.identidad.roles).size > 1;

  function enfocarTitulo() {
    const titulo = contenido.current?.querySelector('h1[tabindex="-1"]');
    titulo?.focus();
    return Boolean(titulo);
  }

  useEffect(() => {
    const escritorio = window.matchMedia("(min-width: 1024px)");
    const cerrarAlAmpliar = () => {
      if (escritorio.matches) setMenuAbierto(false);
    };
    escritorio.addEventListener("change", cerrarAlAmpliar);
    return () => escritorio.removeEventListener("change", cerrarAlAmpliar);
  }, []);

  return (
    <div className="panel-operativo" data-rol={rol}>
      <a href="#contenido-panel" className="panel-salto">Saltar al contenido</a>
      <aside className="panel-lateral hidden lg:flex">
        <MarcaPanel />
        <NavegacionPanel grupos={grupos} activo={activo} alSeleccionar={alSeleccionar} />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="panel-cabecera">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
              <SheetTrigger asChild>
                <button ref={activadorMenu} type="button" aria-label="Abrir menú del panel" className="panel-icono-boton lg:hidden">
                  <Menu aria-hidden="true" className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" aria-describedby={undefined}
                onCloseAutoFocus={evento => {
                  const enfocarDestino = enfocarAlCerrarMenu.current;
                  enfocarAlCerrarMenu.current = false;
                  if (enfocarDestino && enfocarTitulo()) {
                    evento.preventDefault();
                    return;
                  }
                  const activador = activadorMenu.current;
                  if (activador?.getClientRects().length) {
                    evento.preventDefault();
                    activador.focus({ preventScroll: true });
                  }
                }}
                className="panel-menu-movil w-[90vw] max-w-80 gap-0 bg-sidebar p-0 sm:max-w-80 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none">
                <SheetTitle className="sr-only">Menú del panel</SheetTitle>
                <MarcaPanel />
                <NavegacionPanel grupos={grupos} activo={activo} alSeleccionar={alSeleccionar}
                  alCerrar={id => {
                    enfocarAlCerrarMenu.current = id !== activo;
                    setMenuAbierto(false);
                  }} />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground lg:hidden">MasterExpress Control</p>
              <p className="truncate text-sm font-semibold sm:text-base">{seccion}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <SelectorTema />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button ref={activadorCuenta} type="button" className="panel-cuenta" aria-label="Menú de cuenta">
                  {avatar || <span aria-hidden="true" className="panel-avatar">{iniciales}</span>}
                  <span className="panel-cuenta__identidad">
                    <span className="block truncate text-sm font-semibold leading-snug">{nombreVisible}</span>
                    <span className="block text-xs text-muted-foreground">{rol}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12}
                className="panel-cuenta-menu motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
                onCloseAutoFocus={evento => {
                  const enfocarDestino = enfocarAlCerrarCuenta.current;
                  enfocarAlCerrarCuenta.current = false;
                  if (!enfocarDestino) return;
                  if (!alAbrirPerfil && rol !== "Administrador") {
                    evento.preventDefault();
                    setPerfilAbierto(true);
                  } else if (enfocarTitulo()) {
                    evento.preventDefault();
                  }
                }}>
                <DropdownMenuLabel className="px-3 py-2 [overflow-wrap:anywhere]">
                  <span className="block">{nombreVisible}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{rol}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(alAbrirPerfil || estado.tipo === "autenticado") && (
                  <DropdownMenuItem className="panel-cuenta-menu__accion" onSelect={() => {
                    enfocarAlCerrarCuenta.current = true;
                    if (rol === "Administrador") navegar("/MiPerfil");
                    else alAbrirPerfil?.();
                  }}>
                    <UserRound aria-hidden="true" /> Ver perfil
                  </DropdownMenuItem>
                )}
                {variosRoles && (
                  <DropdownMenuItem asChild className="panel-cuenta-menu__accion">
                    <Link to="/"><ArrowLeftRight aria-hidden="true" /> Cambiar de panel</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="panel-cuenta-menu__accion" onSelect={() => void cerrar()}>
                  <LogOut aria-hidden="true" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {!alAbrirPerfil && rol !== "Administrador" && estado.tipo === "autenticado" && (
          <Dialog open={perfilAbierto} onOpenChange={setPerfilAbierto}>
            <DialogContent aria-describedby={undefined}
              className="panel-perfil w-[calc(100%-2rem)] max-w-sm rounded-xl sm:rounded-xl motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
              onCloseAutoFocus={evento => {
                evento.preventDefault();
                activadorCuenta.current?.focus({ preventScroll: true });
              }}>
              <DialogTitle>Mi perfil</DialogTitle>
              <dl className="grid gap-3 text-sm [overflow-wrap:anywhere]">
                <div><dt className="text-muted-foreground">Nombre</dt><dd className="font-medium">{nombreVisible}</dd></div>
                <div><dt className="text-muted-foreground">Correo electrónico</dt><dd className="font-medium">{estado.identidad.correo}</dd></div>
                <div><dt className="text-muted-foreground">Rol en este panel</dt><dd className="font-medium">{rol}</dd></div>
              </dl>
              <DialogClose asChild><Button type="button" variant="outline" className="min-h-11 justify-self-end">Cerrar</Button></DialogClose>
            </DialogContent>
          </Dialog>
        )}
        <main id="contenido-panel" ref={contenido} tabIndex={-1} className="panel-contenido">{children}</main>
      </div>
    </div>
  );
}
