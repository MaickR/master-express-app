import React, { useState, useEffect } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import { Lightbulb, AlertCircle, CheckCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";

export default function Recomendaciones() {
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generarRecomendaciones();
  }, []);

  const generarRecomendaciones = async () => {
    try {
      const [graduandosRaw, gastos] = await Promise.all([
        base44.entities.Graduando.list(),
        base44.entities.Gasto.list()
      ]);

      // Excluir eliminados (papelera)
      const graduandos = graduandosRaw.filter(g => !g.eliminado);

      const recs = [];
      const pendientes = graduandos.filter(g => g.estado_pago === 'pendiente');
      const ingresosTotales = graduandos.reduce((s, g) => s + (g.valor_total || 0), 0);
      const totalGastos = gastos.reduce((s, g) => s + (g.valor || 0), 0);
      const completos = graduandos.filter(g => g.estado_pago === 'completo');

      if (pendientes.length > 0) {
        if (pendientes.length >= 5) {
          recs.push({
            tipo: "warning", icon: AlertCircle,
            texto: `Existen ${pendientes.length} graduandos con saldo pendiente. Se recomienda realizar seguimiento a los pagos.`
          });
        } else {
          recs.push({
            tipo: "info", icon: Info,
            texto: `Hay ${pendientes.length} graduando(s) con saldo pendiente. Recuerde verificar los comprobantes antes de entregar los paquetes.`
          });
        }
      }

      if (ingresosTotales > 0 && totalGastos > 0) {
        const porcentaje = (totalGastos / ingresosTotales) * 100;
        if (porcentaje > 40) {
          recs.push({
            tipo: "warning", icon: AlertCircle,
            texto: `Los gastos representan un ${Math.round(porcentaje)}% de los ingresos. Considere revisar y optimizar los gastos operativos.`
          });
        }
      }

      const completosSinComprobante = completos.filter(g => !(g.comprobante_urls || g.foto_urls) || (g.comprobante_urls || g.foto_urls)?.length === 0);
      if (completosSinComprobante.length > 0) {
        recs.push({
          tipo: "info", icon: Info,
          texto: `${completosSinComprobante.length} graduando(s) con pago completo no tienen comprobante registrado. Verifique antes de la entrega.`
        });
      }

      if (graduandos.length === 0) {
        recs.push({
          tipo: "info", icon: Lightbulb,
          texto: "Aún no hay graduandos registrados para este resumen."
        });
      }

      if (recs.length === 0 && graduandos.length > 0) {
        recs.push({
          tipo: "success", icon: CheckCircle,
          texto: "¡Todo en orden! Los pagos están al día y las finanzas se ven saludables."
        });
      }

      setRecomendaciones(recs);
    } catch (error) {
      console.error("Error generando recomendaciones:", error);
    }
    setLoading(false);
  };

  const coloresIcono = { warning: "text-aviso", info: "text-info", success: "text-exito" };
  const coloresBg = {
    warning: "bg-aviso-suave border-border",
    info: "bg-info-suave border-border",
    success: "bg-exito-suave border-border"
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  if (recomendaciones.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-foreground font-heading flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-accent" />
        Recomendaciones
      </h3>
      {recomendaciones.map((rec, i) => {
        const Icon = rec.icon;
        return (
          <Card key={i} className={`border ${coloresBg[rec.tipo]}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <Icon className={`w-5 h-5 ${coloresIcono[rec.tipo]} shrink-0 mt-0.5`} />
              <p className="text-sm text-foreground">{rec.texto}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
