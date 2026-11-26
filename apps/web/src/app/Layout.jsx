import React from "react";
import { useLocation } from "react-router-dom";
import { GraduationCap, UserPlus } from "lucide-react";
import PanelOperativo from "@/shared/components/PanelOperativo";
import { base44, useLocalEntities } from "@/integrations/base44/base44Client";
import { useQuery } from "@tanstack/react-query";

const navegacionColaborador = [{
  id: "operacion",
  destinos: [
    { id: "ColaboradorDashboard", label: "Mis graduandos", url: "/ColaboradorDashboard", icon: GraduationCap },
    { id: "RegistroGraduando", label: "Registrar graduando", url: "/RegistroGraduando", icon: UserPlus },
  ],
}];

/** @param {{ identidad: import('@/features/acceso/cliente-sesion').Identidad,
 * Pantalla: React.ComponentType<{ colaboradorId: string; nombre: string }> }} props */
export default function Layout({ identidad, Pantalla }) {
  const { pathname } = useLocation();
  const { data: colaboradorId, isPending, isError, refetch } = useQuery({
    queryKey: ["perfil-operativo-local", identidad.id, identidad.correo],
    enabled: useLocalEntities,
    retry: false,
    queryFn: async () => {
      // Este vínculo solo usa datos ficticios del adaptador local y nunca otorga un rol.
      const perfiles = await base44.entities.Colaborador.filter({ email: identidad.correo });
      return perfiles.length === 1 && perfiles[0].activo !== false ? perfiles[0].id : null;
    },
  });
  const activo = navegacionColaborador[0].destinos.find(destino =>
    destino.url.toLowerCase() === pathname.toLowerCase()
  )?.id || "ColaboradorDashboard";

  return (
    <PanelOperativo grupos={navegacionColaborador} activo={activo}
      rol="Colaborador" nombre={identidad.nombre}>
      {colaboradorId ? <Pantalla key={colaboradorId} colaboradorId={colaboradorId} nombre={identidad.nombre} /> : (
        <div className="panel-pagina">
          <div className="panel-portada">
            <div>
              <h1>{activo === "RegistroGraduando" ? "Registrar graduando" : "Mi panel"}</h1>
              <p>Bienvenido, {identidad.nombre}.</p>
            </div>
          </div>
          <div className="panel-estado">
            {useLocalEntities && isPending ? <p role="status">Buscando el perfil operativo…</p> : isError ? (
              <>
                <p role="alert">No se pudo consultar el perfil operativo.</p>
                <button type="button" className="panel-accion mx-auto" onClick={() => void refetch()}>Volver a intentar</button>
              </>
            ) : <p>Los registros requieren un perfil operativo vinculado a esta cuenta.</p>}
          </div>
        </div>
      )}
    </PanelOperativo>
  );
}
