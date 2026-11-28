import React, { useState, useEffect } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import {
  GraduationCap, Wallet, CheckCircle,
  AlertCircle, TrendingUp, TrendingDown, PiggyBank
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

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
    <div className="flex items-center justify-center py-12" role="status"><span className="sr-only">Cargando resumen financiero…</span>
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  if (!data) return (
    <div className="panel-estado">
      <p role="alert">No se pudo cargar el resumen financiero.</p>
      <button type="button" className="panel-accion mx-auto" onClick={() => { setLoading(true); void loadData(); }}>Volver a intentar</button>
    </div>
  );

  const gananciaNeta = data.totalAbonado - data.totalGastos;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="break-words text-2xl font-bold text-foreground font-heading">Resumen Financiero</h2>
        <p className="text-muted-foreground text-sm mt-1">Salud financiera del negocio (excluye graduandos en papelera)</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Graduandos", value: data.totalGraduandos, icon: GraduationCap, bg: "bg-accent", text: "text-accent-foreground" },
          { label: "Pagos Completos", value: data.pagosCompletos, icon: CheckCircle, bg: "bg-exito-suave", text: "text-exito" },
          { label: "Pendientes", value: data.pagosPendientes, icon: AlertCircle, bg: "bg-aviso-suave", text: "text-aviso" },
          { label: "Total Gastos", value: formatCurrency(data.totalGastos), icon: Wallet, bg: "bg-muted", text: "text-accent", isCurrency: true },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-4">
              <div className={`p-2 rounded-lg ${kpi.bg} w-fit mb-2`}>
                <kpi.icon className={`w-5 h-5 ${kpi.text}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
              <p className={`font-bold break-words tabular-nums font-heading ${kpi.isCurrency ? 'text-base' : 'text-xl'} text-foreground`}>
                {kpi.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Finanzas detalladas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border bg-exito-suave">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2 text-exito">
              <TrendingUp className="w-5 h-5" /> Ingresos Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-2xl font-bold text-exito font-heading">{formatCurrency(data.ingresosTotales)}</p>
            <p className="text-xs text-muted-foreground mt-1">Valor total de todos los paquetes activos</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2 text-accent-foreground">
              <PiggyBank className="w-5 h-5" /> Total Abonado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-2xl font-bold text-accent-foreground font-heading">{formatCurrency(data.totalAbonado)}</p>
            <p className="text-xs text-muted-foreground mt-1">Dinero efectivamente recibido</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-aviso-suave">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2 text-aviso">
              <AlertCircle className="w-5 h-5" /> Pendiente por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-2xl font-bold text-aviso font-heading">{formatCurrency(data.totalPendienteCobrar)}</p>
            <p className="text-xs text-muted-foreground mt-1">Saldos aún no cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Ganancia Neta */}
      <Card className={`border-2 ${gananciaNeta >= 0 ? 'border-border bg-exito-suave' : 'border-border bg-error-suave'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            {gananciaNeta >= 0
              ? <TrendingUp className="w-6 h-6 text-exito" />
              : <TrendingDown className="w-6 h-6 text-error" />}
            Ganancia Neta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className={`break-words text-3xl font-bold font-heading ${gananciaNeta >= 0 ? 'text-exito' : 'text-error'}`}>
                {formatCurrency(gananciaNeta)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Abonos recibidos ({formatCurrency(data.totalAbonado)}) — Gastos ({formatCurrency(data.totalGastos)})
              </p>
            </div>
            <Badge className={gananciaNeta >= 0 ? 'bg-exito-suave text-exito' : 'bg-error-suave text-error'}>
              {gananciaNeta >= 0 ? 'POSITIVO' : 'NEGATIVO'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores simples */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium">% Completado</p>
                <p className="text-xl font-bold text-foreground font-heading">
                  {data.totalGraduandos > 0 ? Math.round((data.pagosCompletos / data.totalGraduandos) * 100) : 0}%
                </p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-exito-suave border-t-exito flex items-center justify-center">
                <span className="text-sm font-bold text-exito">
                  {data.totalGraduandos > 0 ? Math.round((data.pagosCompletos / data.totalGraduandos) * 100) : 0}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.pagosCompletos} de {data.totalGraduandos} graduandos han pagado completo
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium">% Gastos vs Ingresos</p>
                <p className="text-xl font-bold text-foreground font-heading">
                  {data.ingresosTotales > 0 ? Math.round((data.totalGastos / data.ingresosTotales) * 100) : 0}%
                </p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-aviso-suave border-t-aviso flex items-center justify-center">
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
