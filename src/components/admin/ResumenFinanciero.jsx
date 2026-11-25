import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  GraduationCap, DollarSign, Wallet, CheckCircle,
  AlertCircle, TrendingUp, TrendingDown, PiggyBank
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ResumenFinanciero() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [graduandosRaw, gastos] = await Promise.all([
        base44.entities.Graduando.list(),
        base44.entities.Gasto.list()
      ]);

      // Excluir papelera en TODOS los cálculos
      const graduandos = graduandosRaw.filter(g => !g.eliminado);
      const completos = graduandos.filter(g => g.estado_pago === 'completo');
      const pendientes = graduandos.filter(g => g.estado_pago === 'pendiente');
      const ingresosTotales = graduandos.reduce((s, g) => s + (g.valor_total || 0), 0);
      const totalAbonado = graduandos.reduce((s, g) => s + (g.abono || 0), 0);
      const totalPendienteCobrar = graduandos.reduce((s, g) => s + (g.saldo || 0), 0);
      const totalGastos = gastos.reduce((s, g) => s + (g.valor || 0), 0);

      setData({
        totalGraduandos: graduandos.length,
        pagosCompletos: completos.length,
        pagosPendientes: pendientes.length,
        ingresosTotales,
        totalAbonado,
        totalPendienteCobrar,
        totalGastos
      });
    } catch (error) {
      console.error("Error cargando resumen:", error);
    }
    setLoading(false);
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  const gananciaNeta = data.totalAbonado - data.totalGastos;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading">Resumen Financiero</h2>
        <p className="text-muted-foreground text-sm mt-1">Salud financiera del negocio (excluye graduandos en papelera)</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Graduandos", value: data.totalGraduandos, icon: GraduationCap, bg: "bg-primary/10", text: "text-primary" },
          { label: "Pagos Completos", value: data.pagosCompletos, icon: CheckCircle, bg: "bg-green-100", text: "text-green-600" },
          { label: "Pendientes", value: data.pagosPendientes, icon: AlertCircle, bg: "bg-amber-100", text: "text-amber-600" },
          { label: "Total Gastos", value: formatCurrency(data.totalGastos), icon: Wallet, bg: "bg-accent/10", text: "text-accent", isCurrency: true },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4">
              <div className={`p-2 rounded-lg ${kpi.bg} w-fit mb-2`}>
                <kpi.icon className={`w-5 h-5 ${kpi.text}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
              <p className={`font-bold font-heading ${kpi.isCurrency ? 'text-base' : 'text-xl'} text-foreground`}>
                {kpi.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Finanzas detalladas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/50 bg-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2 text-green-700">
              <TrendingUp className="w-5 h-5" /> Ingresos Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700 font-heading">{formatCurrency(data.ingresosTotales)}</p>
            <p className="text-xs text-muted-foreground mt-1">Valor total de todos los paquetes activos</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2 text-primary">
              <PiggyBank className="w-5 h-5" /> Total Abonado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary font-heading">{formatCurrency(data.totalAbonado)}</p>
            <p className="text-xs text-muted-foreground mt-1">Dinero efectivamente recibido</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5" /> Pendiente por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700 font-heading">{formatCurrency(data.totalPendienteCobrar)}</p>
            <p className="text-xs text-muted-foreground mt-1">Saldos aún no cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Ganancia Neta */}
      <Card className={`border-2 ${gananciaNeta >= 0 ? 'border-green-200 bg-green-50/20' : 'border-accent/30 bg-accent/5'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            {gananciaNeta >= 0
              ? <TrendingUp className="w-6 h-6 text-green-600" />
              : <TrendingDown className="w-6 h-6 text-accent" />}
            Ganancia Neta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-3xl font-bold font-heading ${gananciaNeta >= 0 ? 'text-green-700' : 'text-accent'}`}>
                {formatCurrency(gananciaNeta)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Abonos recibidos ({formatCurrency(data.totalAbonado)}) — Gastos ({formatCurrency(data.totalGastos)})
              </p>
            </div>
            <Badge className={gananciaNeta >= 0 ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent'}>
              {gananciaNeta >= 0 ? 'POSITIVO' : 'NEGATIVO'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores simples */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">% Completado</p>
                <p className="text-xl font-bold text-foreground font-heading">
                  {data.totalGraduandos > 0 ? Math.round((data.pagosCompletos / data.totalGraduandos) * 100) : 0}%
                </p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-green-200 border-t-green-500 flex items-center justify-center">
                <span className="text-sm font-bold text-green-600">
                  {data.totalGraduandos > 0 ? Math.round((data.pagosCompletos / data.totalGraduandos) * 100) : 0}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.pagosCompletos} de {data.totalGraduandos} graduandos han pagado completo
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">% Gastos vs Ingresos</p>
                <p className="text-xl font-bold text-foreground font-heading">
                  {data.ingresosTotales > 0 ? Math.round((data.totalGastos / data.ingresosTotales) * 100) : 0}%
                </p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-accent/20 border-t-accent flex items-center justify-center">
                <span className="text-sm font-bold text-accent">
                  {data.ingresosTotales > 0 ? Math.round((data.totalGastos / data.ingresosTotales) * 100) : 0}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Los gastos representan este porcentaje de los ingresos
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}