import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, UserPlus, DollarSign, CheckCircle,
  AlertCircle, ReceiptText, LogOut
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import MisGraduandos from "@/components/colaborador/MisGraduandos";

export default function ColaboradorDashboard() {
  const navigate = useNavigate();
  const [colaborador, setColaborador] = useState(null);
  const [colaboradorId, setColaboradorId] = useState(null);
  const [misGraduandos, setMisGraduandos] = useState([]);
  const [loading, setLoading] = useState(true);

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
          const storedId = localStorage.getItem("colaborador_id");
          if (event.data.colaborador_id === storedId) {
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
        const storedId = localStorage.getItem("colaborador_id");
        if (event.data.colaborador_id === storedId) {
          setMisGraduandos(prev => [...prev, event.data]);
        }
      }
    });
    return () => unsub();
  }, []);

  const init = async () => {
    const storedId = localStorage.getItem("colaborador_id");
    if (!storedId) {
      navigate('/');
      return;
    }

    try {
      const colData = await base44.entities.Colaborador.get(storedId);
      if (!colData || colData.activo === false) {
        localStorage.removeItem("colaborador_id");
        navigate('/');
        return;
      }
      setColaborador(colData);
      setColaboradorId(storedId);

      // Load only THIS collaborator's graduandos (excluir eliminados)
      const graduandos = await base44.entities.Graduando.filter({ colaborador_id: storedId });
      setMisGraduandos(graduandos.filter(g => !g.eliminado));
    } catch (error) {
      console.error("Error iniciando dashboard:", error);
      navigate('/');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("colaborador_id");
    localStorage.removeItem("colaborador_nombre");
    navigate('/');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
  };

  const completos = misGraduandos.filter(g => g.estado_pago === 'completo');
  const pendientes = misGraduandos.filter(g => g.estado_pago === 'pendiente');
  const totalAbonado = misGraduandos.reduce((sum, g) => sum + (g.abono || 0), 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground font-heading tracking-tight">
                Mi Panel
              </h1>
              <p className="text-muted-foreground mt-1">
                Bienvenido, {colaborador?.nombre_completo || colaborador?.username || 'Colaborador'}
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/RegistroGraduando">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-medium">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Registrar Graduando
                </Button>
              </Link>
              <Button variant="outline" onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Mis Graduandos", value: misGraduandos.length, icon: GraduationCap, bg: "bg-primary/10", text: "text-primary" },
            { label: "Pagos Completos", value: completos.length, icon: CheckCircle, bg: "bg-green-100", text: "text-green-600" },
            { label: "Pendientes", value: pendientes.length, icon: AlertCircle, bg: "bg-amber-100", text: "text-amber-600" },
            { label: "Total Abonado", value: formatCurrency(totalAbonado), icon: DollarSign, bg: "bg-accent/10", text: "text-accent", isCurrency: true },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
              <Card className="border-border/50">
                <CardContent className="p-4 lg:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-5 h-5 ${stat.text}`} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">{stat.label}</p>
                  <p className={`font-bold font-heading ${stat.isCurrency ? 'text-sm lg:text-base' : 'text-xl lg:text-2xl'} text-foreground`}>
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {misGraduandos.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8">
            <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
              <CardContent className="p-8 text-center">
                <ReceiptText className="w-16 h-16 mx-auto mb-4 text-primary/40" />
                <h3 className="text-xl font-bold text-foreground font-heading mb-2">
                  ¡Comience a registrar graduandos!
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Aún no tiene graduandos registrados. Presione el botón para crear su primer registro.
                </p>
                <Link to="/RegistroGraduando">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Registrar Primer Graduando
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Graduandos list */}
        <MisGraduandos graduandos={misGraduandos} onUpdate={init} />
      </div>
    </div>
  );
}