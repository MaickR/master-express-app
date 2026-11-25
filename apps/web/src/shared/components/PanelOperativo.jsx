import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

/**
 * @typedef {{ id: string, label: string, icon: import("lucide-react").LucideIcon, url?: string }} Destino
 * @typedef {{ id: string, label?: string, destinos: Destino[] }} Grupo
 */

/** @param {{ grupos: Grupo[], activo: string, alSeleccionar?: (id: string) => void, alCerrar?: () => void }} props */
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
                    <Link to={url} aria-current={actual} onClick={alCerrar} className="panel-navegacion__destino">
                      {contenido}
                    </Link>
                  ) : (
                    <button type="button" aria-current={actual} className="panel-navegacion__destino"
                      onClick={() => { alSeleccionar?.(id); alCerrar?.(); }}>
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
 *   grupos: Grupo[], activo: string, rol: string, nombre: string, alSalir: () => void,
 *   alSeleccionar?: (id: string) => void, avatar?: React.ReactNode, herramientas?: React.ReactNode,
 *   children: React.ReactNode
 * }} props
 */
export default function PanelOperativo({ grupos, activo, rol, nombre, alSalir, alSeleccionar, avatar, herramientas, children }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const seccion = grupos.flatMap(grupo => grupo.destinos).find(destino => destino.id === activo)?.label || rol;
  const iniciales = (nombre || rol).trim().split(/\s+/).slice(0, 2).map(parte => parte.charAt(0)).join("").toUpperCase();

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
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Abrir menú del panel" className="panel-icono-boton lg:hidden">
                  <Menu aria-hidden="true" className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" aria-describedby={undefined}
                className="panel-menu-movil w-[90vw] max-w-80 gap-0 bg-sidebar p-0 sm:max-w-80 motion-reduce:!animate-none">
                <SheetTitle className="sr-only">Menú del panel</SheetTitle>
                <MarcaPanel />
                <NavegacionPanel grupos={grupos} activo={activo} alSeleccionar={alSeleccionar}
                  alCerrar={() => setMenuAbierto(false)} />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-muted-foreground lg:hidden">MasterExpress Control</p>
              <p className="truncate text-sm font-semibold sm:text-base">{seccion}</p>
            </div>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            {herramientas}
            <div className="flex min-w-0 items-center gap-2.5 sm:ml-1">
              {avatar || <span aria-hidden="true" className="panel-avatar">{iniciales}</span>}
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-44 truncate text-sm font-semibold" title={nombre || rol}>{nombre || rol}</p>
                <p className="text-xs text-muted-foreground">{rol}</p>
              </div>
            </div>
            <button type="button" onClick={alSalir} className="panel-icono-boton" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut aria-hidden="true" className="size-[18px]" />
            </button>
          </div>
        </header>
        <main id="contenido-panel" tabIndex={-1} className="panel-contenido">{children}</main>
      </div>
    </div>
  );
}
