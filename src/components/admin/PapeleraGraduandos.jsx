import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, RotateCcw, Loader2, Trash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function PapeleraGraduandos() {
  const [eliminados, setEliminados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEliminados();
    // Suscripción en tiempo real
    const unsub = base44.entities.Graduando.subscribe((event) => {
      if (event.type === "update" && event.data) {
        if (event.data.eliminado) {
          // Recién enviado a papelera
          setEliminados(prev => prev.find(g => g.id === event.data.id) ? prev : [...prev, event.data]);
        } else {
          // Restaurado — quitar de papelera
          setEliminados(prev => prev.filter(g => g.id !== event.data.id));
        }
      }
      if (event.type === "delete") {
        setEliminados(prev => prev.filter(g => g.id !== event.id));
      }
    });
    return () => unsub();
  }, []);

  const cargarEliminados = async () => {
    setLoading(true);
    try {
      const todos = await base44.entities.Graduando.filter({ eliminado: true });
      setEliminados(todos);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const restaurar = async (g) => {
    await base44.entities.Graduando.update(g.id, { eliminado: false, fecha_eliminacion: null });
    setEliminados(prev => prev.filter(x => x.id !== g.id));
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v || 0);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading">Papelera de Graduandos</h2>
        <p className="text-muted-foreground text-sm mt-1">
          La eliminación definitiva está deshabilitada. Puedes restaurar los registros de la papelera.
        </p>
      </div>

      {eliminados.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-12 text-center">
            <Trash className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">La papelera está vacía</p>
            <p className="text-sm text-muted-foreground/60 mt-1">No hay graduandos eliminados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {eliminados.map(g => (
            <Card key={g.id} className="border-border/50">
              <CardContent className="p-4 lg:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-foreground">{g.nombre_completo}</h4>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      {g.correo && <p>✉ {g.correo}</p>}
                      {g.telefono && <p>📱 {g.telefono}</p>}
                      <p>Eliminado el: {formatDate(g.fecha_eliminacion)}</p>
                      <p>Pago: {formatCurrency(g.valor_total)} — Saldo: {formatCurrency(g.saldo)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => restaurar(g)}
                      className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50">
                      <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                    </Button>
                    <button type="button" disabled
                      className={buttonVariants({ size: "sm", variant: "destructive", className: "gap-1.5" })}>
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
