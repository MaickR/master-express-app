import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/integrations/base44/base44Client";
import { GraduationCap, UserPlus } from "lucide-react";
import PanelOperativo from "@/shared/components/PanelOperativo";
import DarkModeToggle from "@/shared/components/DarkModeToggle";

const NO_LAYOUT_PAGES = ["Home", "AdminDashboard"];

const navegacionColaborador = [{
  id: "operacion",
  destinos: [
    { id: "ColaboradorDashboard", label: "Mis graduandos", url: "/ColaboradorDashboard", icon: GraduationCap },
    { id: "RegistroGraduando", label: "Registrar graduando", url: "/RegistroGraduando", icon: UserPlus },
  ],
}];

export default function Layout({ children, currentPageName }) {
  const [colaboradorName, setColaboradorName] = useState(localStorage.getItem("colaborador_nombre") || "");
  const location = useLocation();

  useEffect(() => {
    const colabId = localStorage.getItem("colaborador_id");
    if (colabId && !colaboradorName) {
      base44.entities.Colaborador.get(colabId)
        .then(c => { if (c) setColaboradorName(c.nombre_completo || c.username || ""); })
        .catch(() => {});
    }
  }, []);

  if (NO_LAYOUT_PAGES.includes(currentPageName) || !localStorage.getItem("colaborador_id")) {
    return <>{children}</>;
  }

  const cerrarSesion = () => {
    localStorage.removeItem("colaborador_id");
    localStorage.removeItem("colaborador_nombre");
    window.location.href = '/';
  };

  const activo = navegacionColaborador[0].destinos.find(destino =>
    destino.url.toLowerCase() === location.pathname.toLowerCase()
  )?.id;

  return (
    <PanelOperativo grupos={navegacionColaborador} activo={activo || currentPageName}
      rol="Colaborador" nombre={colaboradorName} alSalir={cerrarSesion}
      herramientas={<DarkModeToggle className="!size-11" />}>
      {children}
    </PanelOperativo>
  );
}
