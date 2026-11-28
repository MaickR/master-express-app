import { useLocation } from "react-router-dom";
import { GraduationCap, UserPlus } from "lucide-react";
import PanelOperativo from "@/shared/components/PanelOperativo";
import GestionGraduandos from "@/features/graduandos/gestion-graduandos";

const grupos = [{ id: "operacion", destinos: [
  { id: "ColaboradorDashboard", label: "Mis graduandos", url: "/ColaboradorDashboard", icon: GraduationCap },
  { id: "RegistroGraduando", label: "Registrar graduando", url: "/RegistroGraduando", icon: UserPlus },
] }];

/** @param {{ identidad: import('@/features/acceso/cliente-sesion').Identidad }} props */
export default function Layout({ identidad }) {
  const { pathname } = useLocation();
  const activo = pathname.toLowerCase() === '/registrograduando' ? 'RegistroGraduando' : 'ColaboradorDashboard';
  return <PanelOperativo grupos={grupos} activo={activo} rol="Colaborador" nombre={identidad.nombre}>
    <div className="panel-pagina"><GestionGraduandos actorId={identidad.id} /></div>
  </PanelOperativo>;
}
