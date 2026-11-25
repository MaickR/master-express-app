import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  GraduationCap, UserPlus, LogOut, ChevronRight, ReceiptText, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Pages that handle their own full layout (no sidebar wrapper)
const NO_LAYOUT_PAGES = ["Home", "AdminDashboard"];

const colaboradorNavigation = [
  { title: "Registrar Graduando", url: "/RegistroGraduando", icon: UserPlus },
  { title: "Mis Graduandos",      url: "/ColaboradorDashboard", icon: GraduationCap },
  { title: "Comprobantes",        url: "/ColaboradorDashboard", icon: ReceiptText },
];

function ColaboradorSidebar({ colaboradorName }) {
  const location = useLocation();
  const handleLogout = () => {
    localStorage.removeItem("colaborador_id");
    localStorage.removeItem("colaborador_nombre");
    window.location.href = '/';
  };

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-secondary text-secondary-foreground border-r border-white/10">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold font-heading leading-tight">MASTER EXPRESS</p>
            <p className="text-xs text-secondary-foreground/60">Colaborador</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <p className="text-xs font-semibold text-secondary-foreground/40 uppercase tracking-widest mb-2 px-2">Mi Panel</p>
        {colaboradorNavigation.map(item => {
          const isActive = location.pathname === item.url;
          return (
            <Link key={item.title} to={item.url}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground/70 hover:bg-white/10 hover:text-secondary-foreground'
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.title}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-xs font-bold text-accent-foreground">
            {(() => {
              const partes = (colaboradorName || '').trim().split(/\s+/).filter(Boolean);
              if (partes.length === 0) return 'C';
              if (partes.length === 1) return partes[0][0].toUpperCase();
              return (partes[0][0] + partes[1][0]).toUpperCase();
            })()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-foreground truncate">{colaboradorName || 'Colaborador'}</p>
            <p className="text-xs text-secondary-foreground/50">Colaborador</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}
            className="text-secondary-foreground/50 hover:text-secondary-foreground hover:bg-white/10 h-8 w-8">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default function Layout({ children, currentPageName }) {
  const [colaboradorName, setColaboradorName] = useState(localStorage.getItem("colaborador_nombre") || "");

  useEffect(() => {
    const colabId = localStorage.getItem("colaborador_id");
    if (colabId && !colaboradorName) {
      base44.entities.Colaborador.get(colabId)
        .then(c => { if (c) setColaboradorName(c.nombre_completo || c.username || ""); })
        .catch(() => {});
    }
  }, []);

  // Pages with their own layout
  if (NO_LAYOUT_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  const hasColaboradorSession = !!localStorage.getItem("colaborador_id");

  if (hasColaboradorSession) {
    return (
      <div className="min-h-screen flex bg-background safe-min-h">
        <ColaboradorSidebar colaboradorName={colaboradorName} />

        {/* Mobile top bar */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-secondary border-b border-white/10 px-4 py-3 safe-top">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-bold text-secondary-foreground text-sm font-heading">MASTER EXPRESS EVENTOS</span>
          </div>
        </div>

        <main className="flex-1 flex flex-col min-w-0 lg:pt-0 pt-14">
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    );
  }

  // No session — just render children (Home handles its own full-screen layout)
  return <>{children}</>;
}