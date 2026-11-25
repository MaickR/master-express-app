import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, GraduationCap, DollarSign, TrendingUp, Users, Wallet, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#6BA3D6', '#E87C7C', '#059669', '#7c3aed', '#1B3A6B'];

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

export default function Reportes() {
  const [graduandos, setGraduandos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [ceremonias, setCeremonias] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [colaboradores, setColaboradores] = useState({});
  const [loading, setLoading] = useState(true);

  // Filtros de informe
  const [filtroEvento, setFiltroEvento] = useState("todos");
  const [filtroCeremonia, setFiltroCeremonia] = useState("todos");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [grads, evs, cers, cols, gasts] = await Promise.all([
        base44.entities.Graduando.list(),
        base44.entities.Evento.list(),
        base44.entities.Ceremonia.list(),
        base44.entities.Colaborador.list(),
        base44.entities.Gasto.list()
      ]);
      // Excluir papelera
      setGraduandos(grads.filter(g => !g.eliminado));
      setEventos(evs);
      setCeremonias(cers);
      setGastos(gasts);
      const colMap = {};
      cols.forEach(c => { colMap[c.id] = c; });
      setColaboradores(colMap);
    } catch (error) {
      console.error("Error cargando reportes:", error);
    }
    setLoading(false);
  };

  // Ceremonias del evento seleccionado
  const ceremoniasDelEvento = filtroEvento !== "todos"
    ? ceremonias.filter(c => c.evento_id === filtroEvento)
    : [];

  // Cuando cambia el evento, resetea la ceremonia
  const handleFiltroEvento = (v) => { setFiltroEvento(v); setFiltroCeremonia("todos"); };

  // Graduandos filtrados según evento/ceremonia
  const graduandosFiltrados = graduandos.filter(g => {
    if (filtroEvento !== "todos" && g.evento_id !== filtroEvento) return false;
    if (filtroCeremonia !== "todos" && g.ceremonia_id !== filtroCeremonia) return false;
    return true;
  });

  // KPIs sobre el conjunto filtrado
  const totalCompletos = graduandosFiltrados.filter(g => g.estado_pago === 'completo').length;
  const totalPendientes = graduandosFiltrados.filter(g => g.estado_pago === 'pendiente').length;
  const ingresosTotales = graduandosFiltrados.reduce((s, g) => s + (g.valor_total || 0), 0);
  const abonosTotales = graduandosFiltrados.reduce((s, g) => s + (g.abono || 0), 0);
  const saldosPendientes = graduandosFiltrados.reduce((s, g) => s + (g.saldo || 0), 0);
  const totalGastos = gastos.reduce((s, g) => s + (g.valor || 0), 0);

  const reportesPorColaborador = Object.entries(colaboradores).map(([id, col]) => {
    const grads = graduandosFiltrados.filter(g => g.colaborador_id === id);
    return {
      nombre: col.nombre_completo?.split(' ')[0] || col.username,
      graduandos: grads.length,
      ingresos: grads.reduce((s, g) => s + (g.valor_total || 0), 0)
    };
  }).filter(r => r.graduandos > 0);

  // Reportes por evento/ceremonia — sólo cuando no hay filtros activos (vista general)
  const reportesPorEvento = eventos.map(ev => {
    const grads = graduandos.filter(g => g.evento_id === ev.id);
    const cersEv = ceremonias.filter(c => c.evento_id === ev.id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    return {
      id: ev.id,
      nombre: ev.nombre_institucion,
      graduandos: grads.length,
      ingresos: grads.reduce((s, g) => s + (g.valor_total || 0), 0),
      abonos: grads.reduce((s, g) => s + (g.abono || 0), 0),
      saldos: grads.reduce((s, g) => s + (g.saldo || 0), 0),
      completos: grads.filter(g => g.estado_pago === 'completo').length,
      pendientes: grads.filter(g => g.estado_pago === 'pendiente').length,
      ceremonias: cersEv.map(cer => {
        const cerGrads = grads.filter(g => g.ceremonia_id === cer.id);
        return {
          nombre: cer.nombre,
          graduandos: cerGrads.length,
          ingresos: cerGrads.reduce((s, g) => s + (g.valor_total || 0), 0),
          abonos: cerGrads.reduce((s, g) => s + (g.abono || 0), 0),
          saldos: cerGrads.reduce((s, g) => s + (g.saldo || 0), 0),
          completos: cerGrads.filter(g => g.estado_pago === 'completo').length,
          pendientes: cerGrads.filter(g => g.estado_pago === 'pendiente').length,
        };
      })
    };
  });

  const pagoData = [
    { name: 'Completos', value: totalCompletos },
    { name: 'Pendientes', value: totalPendientes }
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Cargando reportes...</p>
      </div>
    </div>
  );

  // Título dinámico del filtro activo
  const eventoActivo = filtroEvento !== "todos" ? eventos.find(e => e.id === filtroEvento) : null;
  const ceremoniaActiva = filtroCeremonia !== "todos" ? ceremonias.find(c => c.id === filtroCeremonia) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading">Reportes e Informes</h2>
        <p className="text-muted-foreground text-sm mt-1">Análisis general del negocio (excluye papelera)</p>
      </div>

      {/* ── Filtros de informe ── */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="w-4 h-4 text-primary" />
              Filtrar informe por:
            </div>
            <Select value={filtroEvento} onValueChange={handleFiltroEvento}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Todos los eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los eventos</SelectItem>
                {eventos.map(ev => (
                  <SelectItem key={ev.id} value={ev.id}>{ev.nombre_institucion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtroEvento !== "todos" && (
              <Select value={filtroCeremonia} onValueChange={setFiltroCeremonia}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="Todas las ceremonias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las ceremonias</SelectItem>
                  {ceremoniasDelEvento.map(cer => (
                    <SelectItem key={cer.id} value={cer.id}>{cer.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filtroEvento !== "todos" && (
              <Badge className="bg-primary/10 text-primary">
                {eventoActivo?.nombre_institucion}
                {ceremoniaActiva ? ` › ${ceremoniaActiva.nombre}` : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs — calculados sobre el conjunto filtrado */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Ingresos Totales",   value: formatCurrency(ingresosTotales), icon: DollarSign, color: "text-primary",     bg: "bg-primary/10" },
          { label: "Abonos Recibidos",   value: formatCurrency(abonosTotales),   icon: TrendingUp, color: "text-green-600",   bg: "bg-green-100" },
          { label: "Saldos Pendientes",  value: formatCurrency(saldosPendientes),icon: BarChart3,   color: "text-amber-600",   bg: "bg-amber-100" },
          { label: "Total Gastos",       value: formatCurrency(totalGastos),     icon: Wallet,     color: "text-accent",      bg: "bg-accent/10" },
          { label: "Graduandos",         value: graduandosFiltrados.length,      icon: GraduationCap, color: "text-secondary", bg: "bg-secondary/10" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4">
              <div className={`p-2 rounded-lg ${kpi.bg} w-fit mb-2`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground font-heading">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reportesPorColaborador.length > 0 && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Graduandos por Colaborador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={reportesPorColaborador}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="graduandos" fill="#6BA3D6" radius={[4, 4, 0, 0]} name="Graduandos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {graduandosFiltrados.length > 0 && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Estado de Pagos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pagoData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pagoData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#059669' : '#E87C7C'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Informe por evento y ceremonia — sólo en vista general */}
      {filtroEvento === "todos" && reportesPorEvento.filter(r => r.graduandos > 0).length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Informe por Evento y Ceremonia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportesPorEvento.filter(r => r.graduandos > 0).map(rep => (
                <div key={rep.id} className="rounded-xl border border-border overflow-hidden">
                  {/* Fila de evento */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-secondary/10">
                    <span className="font-bold text-foreground text-sm">{rep.nombre}</span>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="text-muted-foreground">{rep.graduandos} grad.</span>
                      <span className="text-green-600 font-semibold">{formatCurrency(rep.ingresos)}</span>
                      <span className="text-primary font-semibold">Abonado: {formatCurrency(rep.abonos)}</span>
                      <span className="text-amber-600 font-semibold">Saldo: {formatCurrency(rep.saldos)}</span>
                      <Badge className="bg-green-100 text-green-700 text-xs">{rep.completos} completos</Badge>
                      <Badge className="bg-amber-100 text-amber-700 text-xs">{rep.pendientes} pendientes</Badge>
                    </div>
                  </div>
                  {/* Filas de ceremonia */}
                  {rep.ceremonias.filter(c => c.graduandos > 0).map((cer, ci) => (
                    <div key={ci} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2 border-t border-border/50 bg-card">
                      <span className="text-sm text-muted-foreground">&#8627; {cer.nombre}</span>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="text-muted-foreground">{cer.graduandos} grad.</span>
                        <span className="text-green-600 font-semibold">{formatCurrency(cer.ingresos)}</span>
                        <span className="text-primary font-semibold">Abonado: {formatCurrency(cer.abonos)}</span>
                        <span className="text-amber-600 font-semibold">Saldo: {formatCurrency(cer.saldos)}</span>
                        <span className="text-green-600">{cer.completos} comp.</span>
                        <span className="text-amber-600">{cer.pendientes} pend.</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}