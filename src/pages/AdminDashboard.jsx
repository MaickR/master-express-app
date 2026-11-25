import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarDays, DollarSign, GraduationCap,
  TrendingUp, CheckCircle, AlertCircle, Shield,
  ClipboardList, BarChart3, Wallet, PiggyBank, ChevronRight, Home, Mail, Trash2,
  Camera, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GestionColaboradores from "@/components/admin/GestionColaboradores";
import GestionEventos from "@/components/admin/GestionEventos";
import GestionPrecios from "@/components/admin/GestionPrecios";
import GestionGastos from "@/components/admin/GestionGastos";
import TodosRegistros from "@/components/admin/TodosRegistros";
import Reportes from "@/components/admin/Reportes";
import ResumenFinanciero from "@/components/admin/ResumenFinanciero";
import Recomendaciones from "@/components/admin/Recomendaciones";
import GestionAdministradores from "@/components/admin/GestionAdministradores";
import ExportarExcel from "@/components/admin/ExportarExcel";
import DarkModeToggle from "@/components/DarkModeToggle";
import GestionCorreos from "@/components/admin/GestionCorreos";
import PapeleraGraduandos from "@/components/admin/PapeleraGraduandos";

const TABS = [
  { id: "panel",         label: "Panel Principal",     icon: Home,          group: "inicio" },
  { id: "colaboradores", label: "Colaboradores",        icon: Users,         group: "gestion" },
  { id: "eventos",       label: "Eventos",              icon: CalendarDays,  group: "gestion" },
  { id: "precios",       label: "Paquetes",             icon: DollarSign,    group: "gestion" },
  { id: "gastos",        label: "Gastos",               icon: Wallet,        group: "financiero" },
  { id: "resumen",       label: "Resumen Financiero",   icon: PiggyBank,     group: "financiero" },
  { id: "registros",     label: "Registros de Graduandos", icon: ClipboardList, group: "datos" },
  { id: "reportes",      label: "Reportes",                icon: BarChart3,     group: "datos" },
  { id: "exportar",      label: "Exportar a Excel",        icon: ClipboardList, group: "datos" },
  { id: "administradores", label: "Administradores",       icon: Shield,        group: "gestion" },
  { id: "correos",         label: "Correos Electrónicos", icon: Mail,          group: "datos" },
  { id: "papelera",        label: "Papelera",             icon: Trash2,        group: "datos" },
];

const GROUPS = [
  { id: "inicio",      label: "Inicio" },
  { id: "gestion",     label: "Gestión" },
  { id: "financiero",  label: "Financiero" },
  { id: "datos",       label: "Datos" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("panel");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalGraduandos: 0, colaboradoresActivos: 0, eventosActivos: 0,
    ingresosTotales: 0, pagosCompletos: 0, pagosPendientes: 0, totalGastos: 0
  });
  const [loading, setLoading] = useState(true);
  const [adminFoto, setAdminFoto] = useState(null);
  const [adminNombre, setAdminNombre] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);

  useEffect(() => {
    checkAccess();
    // Solo carga stats al iniciar — no en cada cambio de tab
    loadStats();
    // Cargar foto de perfil del admin
    const adminId = localStorage.getItem("admin_id");
    const nombre = localStorage.getItem("admin_nombre") || "Administrador";
    setAdminNombre(nombre);
    if (adminId) {
      base44.entities.Administrador.get(adminId)
        .then(admin => { if (admin?.foto_perfil) setAdminFoto(admin.foto_perfil); })
        .catch(() => {});
    }
  }, []);

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const adminId = localStorage.getItem("admin_id");
    if (!adminId) return;
    setUploadingFoto(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Administrador.update(adminId, { foto_perfil: result.file_url });
      setAdminFoto(result.file_url);
    } catch (err) {
      console.error("Error subiendo foto:", err);
    }
    setUploadingFoto(false);
  };

  const checkAccess = () => {
    // Admin access is validated via localStorage (custom Administrador entity)
    const adminId = localStorage.getItem("admin_id");
    if (!adminId) { navigate('/'); }
  };

  const loadStats = async () => {
    try {
      const [graduandosRaw, colaboradores, eventos, gastos] = await Promise.all([
        base44.entities.Graduando.list(),
        base44.entities.Colaborador.filter({ activo: true }),
        base44.entities.Evento.filter({ activo: true }),
        base44.entities.Gasto.list()
      ]);
      const graduandos = graduandosRaw.filter(g => !g.eliminado);
      setStats({
        totalGraduandos: graduandos.length,
        colaboradoresActivos: colaboradores.length,
        eventosActivos: eventos.length,
        ingresosTotales: graduandos.reduce((s, g) => s + (g.valor_total || 0), 0),
        pagosCompletos: graduandos.filter(g => g.estado_pago === 'completo').length,
        pagosPendientes: graduandos.filter(g => g.estado_pago === 'pendiente').length,
        totalGastos: gastos.reduce((s, g) => s + (g.valor || 0), 0)
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

  const activeTabDef = TABS.find(t => t.id === activeTab);
  const gananciaNeta = stats.ingresosTotales - stats.totalGastos;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Cargando panel...</p>
        </div>
      </div>
    );
  }

  // Renderiza solo el tab activo — sin key animada para evitar re-mount
  const renderContent = () => {
    switch (activeTab) {
      case "panel":           return <PanelHome stats={stats} formatCurrency={formatCurrency} gananciaNeta={gananciaNeta} onNavigate={setActiveTab} />;
      case "colaboradores":   return <GestionColaboradores onUpdate={loadStats} />;
      case "eventos":         return <GestionEventos onUpdate={loadStats} />;
      case "precios":         return <GestionPrecios onUpdate={loadStats} />;
      case "gastos":          return <GestionGastos onUpdate={loadStats} />;
      case "resumen":         return <ResumenFinanciero />;
      case "registros":       return <TodosRegistros />;
      case "reportes":        return <Reportes />;
      case "exportar":        return <ExportarExcel />;
      case "administradores": return <GestionAdministradores />;
      case "correos":         return <GestionCorreos />;
      case "papelera":        return <PapeleraGraduandos />;
      default:                return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-secondary text-secondary-foreground flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Sidebar Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Avatar con foto de perfil */}
            <div className="relative shrink-0 group">
              <div
                className="w-12 h-12 rounded-xl overflow-hidden bg-accent flex items-center justify-center cursor-pointer border-2 border-white/20 hover:border-white/50 transition-all"
                onClick={() => fileInputRef.current?.click()}
                title="Cambiar foto de perfil"
              >
                {uploadingFoto ? (
                  <Loader2 className="w-5 h-5 text-accent-foreground animate-spin" />
                ) : adminFoto ? (
                  <img src={adminFoto} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <Shield className="w-5 h-5 text-accent-foreground" />
                )}
              </div>
              {/* Overlay de cámara al hover */}
              {!uploadingFoto && (
                <div
                  className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 text-white" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFotoChange}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-secondary-foreground font-heading leading-tight truncate">MASTER EXPRESS</p>
              <p className="text-xs text-secondary-foreground/60 truncate">{adminNombre}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto space-y-6">
          {GROUPS.map(group => {
            const groupTabs = TABS.filter(t => t.group === group.id);
            return (
              <div key={group.id}>
                <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-3 px-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {groupTabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-secondary-foreground/70 hover:bg-white/10 hover:text-secondary-foreground'
                        }`}>
                        <tab.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{tab.label}</span>
                        {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Stats footer */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="flex justify-between text-xs text-secondary-foreground/60">
            <span>Graduandos</span>
            <span className="font-bold text-secondary-foreground">{stats.totalGraduandos}</span>
          </div>
          <div className="flex justify-between text-xs text-secondary-foreground/60">
            <span>Colaboradores</span>
            <span className="font-bold text-secondary-foreground">{stats.colaboradoresActivos}</span>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Hamburger (mobile only) */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-muted">
              <div className="w-5 h-0.5 bg-foreground mb-1"></div>
              <div className="w-5 h-0.5 bg-foreground mb-1"></div>
              <div className="w-5 h-0.5 bg-foreground"></div>
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground font-heading">
                {activeTabDef?.label || 'Panel'}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Master Express Eventos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <Badge className="bg-accent/10 text-accent border-accent/20 px-3 py-1 text-xs font-medium">
              <Shield className="w-3 h-3 mr-1" /> Admin
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("admin_id"); localStorage.removeItem("admin_nombre"); localStorage.removeItem("admin_rol"); navigate('/'); }}
              className="text-muted-foreground hover:text-foreground text-xs">
              Salir
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// ─── Panel Home ───────────────────────────────────────────────────────────────
function PanelHome({ stats, formatCurrency, gananciaNeta, onNavigate }) {
  const statCards = [
    { label: "Graduandos",    value: stats.totalGraduandos,         icon: GraduationCap, color: "text-primary",   bg: "bg-primary/10"   },
    { label: "Colaboradores", value: stats.colaboradoresActivos,     icon: Users,         color: "text-secondary", bg: "bg-secondary/10" },
    { label: "Eventos",       value: stats.eventosActivos,           icon: CalendarDays,  color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Completos",     value: stats.pagosCompletos,           icon: CheckCircle,   color: "text-green-600", bg: "bg-green-100"    },
    { label: "Pendientes",    value: stats.pagosPendientes,          icon: AlertCircle,   color: "text-amber-600", bg: "bg-amber-100"    },
    { label: "Ingresos",      value: formatCurrency(stats.ingresosTotales), icon: TrendingUp, color: "text-green-600", bg: "bg-green-100", small: true },
    { label: "Gastos",        value: formatCurrency(stats.totalGastos),     icon: Wallet,     color: "text-accent",   bg: "bg-accent/10",  small: true },
  ];

  return (
    <div className="space-y-10">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{s.label}</p>
              <p className={`font-bold font-heading ${s.small ? 'text-xs' : 'text-xl'} text-foreground`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial health */}
      <Card className={`border-2 ${gananciaNeta >= 0 ? 'border-green-200 bg-green-50/30' : 'border-accent/30 bg-accent/5'}`}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gananciaNeta >= 0 ? 'bg-green-100' : 'bg-accent/10'}`}>
                <PiggyBank className={`w-5 h-5 ${gananciaNeta >= 0 ? 'text-green-600' : 'text-accent'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ganancia Neta (Ingresos - Gastos)</p>
                <p className={`text-2xl font-bold font-heading ${gananciaNeta >= 0 ? 'text-green-700' : 'text-accent'}`}>
                  {formatCurrency(Math.abs(gananciaNeta))}
                </p>
              </div>
            </div>
            <Badge className={`text-sm px-4 py-1.5 ${gananciaNeta >= 0 ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent'}`}>
              {gananciaNeta >= 0 ? '✓ POSITIVO' : '✗ NEGATIVO'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-bold text-foreground font-heading mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: "colaboradores", label: "Gestionar Colaboradores", desc: "Crear, editar o desactivar colaboradores", icon: Users,         color: "border-primary/20 hover:border-primary/50 hover:bg-primary/5" },
            { id: "eventos",       label: "Crear Evento",           desc: "Agregar un nuevo evento de graduación",    icon: CalendarDays,  color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50" },
            { id: "gastos",        label: "Registrar Gasto",        desc: "Agregar un nuevo gasto operativo",         icon: Wallet,        color: "border-accent/20 hover:border-accent/50 hover:bg-accent/5" },
            { id: "registros",     label: "Ver Registros de Graduandos", desc: "Consultar todos los graduandos",       icon: ClipboardList, color: "border-secondary/20 hover:border-secondary/50 hover:bg-secondary/5" },
          ].map(action => (
            <button key={action.id} onClick={() => onNavigate(action.id)}
              className={`text-left p-5 rounded-xl border-2 transition-all duration-200 ${action.color} group`}>
              <div className="flex items-start gap-3">
                <action.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground mt-0.5 shrink-0 transition-colors" />
                <div>
                  <p className="font-semibold text-foreground text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <Recomendaciones />
    </div>
  );
}