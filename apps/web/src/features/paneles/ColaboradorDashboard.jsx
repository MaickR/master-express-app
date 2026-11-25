import React, { useState, useEffect } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import {
  GraduationCap, UserPlus, DollarSign, CheckCircle,
  AlertCircle, Loader2
} from "lucide-react";
import IndicadoresPanel from "@/shared/components/IndicadoresPanel";
import { Link } from "react-router-dom";
import MisGraduandos from "@/features/graduandos/MisGraduandos";

/** @param {{ colaboradorId: string, nombre: string }} props */
export default function ColaboradorDashboard({ colaboradorId, nombre }) {
  const [misGraduandos, setMisGraduandos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorRegistros, setErrorRegistros] = useState(false);

  useEffect(() => {
    init();
    // Suscripción en tiempo real para reflejar eliminaciones/restauraciones inmediatamente
    const unsub = base44.entities.Graduando.subscribe((event) => {
      if (event.type === "update" && event.data) {
        if (event.data.eliminado) {
          // Fue enviado a la papelera — quitar de la lista
          setMisGraduandos(prev => prev.filter(g => g.id !== event.data.id));
        } else if (event.data.eliminado === false) {
          // Fue restaurado — recargar si pertenece a este colaborador
          if (event.data.colaborador_id === colaboradorId) {
            setMisGraduandos(prev => {
              const existe = prev.find(g => g.id === event.data.id);
              return existe ? prev.map(g => g.id === event.data.id ? event.data : g) : [...prev, event.data];
            });
          }
        }
      }
      if (event.type === "delete") {
        setMisGraduandos(prev => prev.filter(g => g.id !== event.id));
      }
      if (event.type === "create" && event.data && !event.data.eliminado) {
        if (event.data.colaborador_id === colaboradorId) {
          setMisGraduandos(prev => [...prev, event.data]);
        }
      }
    });
    return () => unsub();
  }, [colaboradorId]);

  const init = async () => {
    setLoading(true);
    setErrorRegistros(false);
    try {
      const graduandos = await base44.entities.Graduando.filter({ colaborador_id: colaboradorId });
      setMisGraduandos(graduandos.filter(g => !g.eliminado));
    } catch (error) {
      console.error("Error consultando los registros del colaborador:", error);
      setErrorRegistros(true);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
  };

  const completos = misGraduandos.filter(g => g.estado_pago === 'completo');
  const pendientes = misGraduandos.filter(g => g.estado_pago === 'pendiente');
  const totalAbonado = misGraduandos.reduce((sum, g) => sum + (g.abono || 0), 0);

  /** @type {React.ComponentProps<typeof IndicadoresPanel>["indicadores"]} */
  const indicadores = [
    { label: "Mis graduandos", value: misGraduandos.length, icon: GraduationCap },
    { label: "Pagos completos", value: completos.length, icon: CheckCircle, tono: "exito" },
    { label: "Pagos pendientes", value: pendientes.length, icon: AlertCircle, tono: "aviso" },
    { label: "Total abonado", value: formatCurrency(totalAbonado), icon: DollarSign, tono: "neutro" },
  ];

  return (
    <div className="panel-pagina">
      <div className="panel-portada">
        <div className="min-w-0">
          <h1>Mi panel</h1>
          <p>Bienvenido, {nombre}.</p>
        </div>
        <Link to="/RegistroGraduando" className="panel-accion shrink-0 md:self-center">
          <UserPlus aria-hidden="true" className="size-[18px]" />
          Registrar graduando
        </Link>
      </div>

      {loading ? (
        <div className="panel-estado" role="status">
          <Loader2 aria-hidden="true" className="mx-auto size-6 animate-spin text-muted-foreground" />
          <p>Cargando registros…</p>
        </div>
      ) : errorRegistros ? (
        <div className="panel-estado">
          <p role="alert">No se pudieron cargar tus registros de graduandos.</p>
          <button type="button" onClick={init} className="panel-accion mx-auto">Volver a intentar</button>
        </div>
      ) : (
        <>
          <section aria-labelledby="indicadores-colaborador" className="space-y-3">
            <h2 id="indicadores-colaborador" className="font-heading text-lg font-semibold">Resumen de tus registros</h2>
            <IndicadoresPanel indicadores={indicadores} />
          </section>
          <MisGraduandos graduandos={misGraduandos} />
        </>
      )}
    </div>
  );
}
