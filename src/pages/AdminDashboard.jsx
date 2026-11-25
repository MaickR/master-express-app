import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarDays, DollarSign, GraduationCap,
  TrendingUp, CheckCircle, AlertCircle, Shield,
  ClipboardList, BarChart3, Wallet, PiggyBank, Home, Mail, Trash2,
  Camera, Loader2, ArrowUpRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PanelOperativo from "@/components/PanelOperativo";
import IndicadoresPanel from "@/components/IndicadoresPanel";
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

const gruposNavegacion = GROUPS.map(grupo => ({
  ...grupo, destinos: TABS.filter(tab => tab.group === grupo.id),
}));

export default function AdminDashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("panel");
  const [stats, setStats] = useState({
    totalGraduandos: 0, colaboradoresActivos: 0, eventosActivos: 0,
    ingresosTotales: 0, pagosCompletos: 0, pagosPendientes: 0, totalGastos: 0
  });
  const [loading, setLoading] = useState(true);
  const [errorIndicadores, setErrorIndicadores] = useState(false);
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
    setLoading(true);
    setErrorIndicadores(false);
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
    } catch (e) {
      console.error(e);
      setErrorIndicadores(true);
    }
    setLoading(false);
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

  const activeTabDef = TABS.find(t => t.id === activeTab);
  const gananciaNeta = stats.ingresosTotales - stats.totalGastos;

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

  const cerrarSesion = () => {
    localStorage.removeItem("admin_id");
    localStorage.removeItem("admin_nombre");
    localStorage.removeItem("admin_rol");
    navigate('/');
  };

  return (
    <PanelOperativo grupos={gruposNavegacion} activo={activeTab} rol="Administrador" nombre={adminNombre}
      alSeleccionar={setActiveTab} alSalir={cerrarSesion} herramientas={<DarkModeToggle className="!size-11" />}
      avatar={
        <button type="button" className="panel-avatar" aria-label="Cambiar foto de perfil"
          title="Cambiar foto de perfil" disabled={uploadingFoto} onClick={() => fileInputRef.current?.click()}>
          {uploadingFoto ? (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          ) : adminFoto ? (
            <img src={adminFoto} alt="" className="size-full object-cover" />
          ) : (
            <Camera aria-hidden="true" className="size-[18px]" />
          )}
        </button>
      }>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
      <div className="panel-pagina">
        {activeTab !== "panel" && <h1 className="sr-only">{activeTabDef?.label}</h1>}
        {activeTab === "panel" && loading ? (
          <div className="panel-estado" role="status">
            <Loader2 aria-hidden="true" className="mx-auto size-6 animate-spin text-muted-foreground" />
            <p>Cargando indicadores del panel…</p>
          </div>
        ) : activeTab === "panel" && errorIndicadores ? (
          <div className="panel-estado">
            <p role="alert">No se pudieron cargar los indicadores del panel.</p>
            <button type="button" onClick={loadStats} className="panel-accion mx-auto">Volver a intentar</button>
          </div>
        ) : renderContent()}
      </div>
    </PanelOperativo>
  );
}

// ─── Panel Home ───────────────────────────────────────────────────────────────
function PanelHome({ stats, formatCurrency, gananciaNeta, onNavigate }) {
  /** @type {React.ComponentProps<typeof IndicadoresPanel>["indicadores"]} */
  const indicadores = [
    { label: "Graduandos", value: stats.totalGraduandos, icon: GraduationCap },
    { label: "Colaboradores", value: stats.colaboradoresActivos, icon: Users },
    { label: "Eventos", value: stats.eventosActivos, icon: CalendarDays },
    { label: "Pagos completos", value: stats.pagosCompletos, icon: CheckCircle, tono: "exito" },
    { label: "Pagos pendientes", value: stats.pagosPendientes, icon: AlertCircle, tono: "aviso" },
    { label: "Ingresos", value: formatCurrency(stats.ingresosTotales), icon: TrendingUp, tono: "exito" },
    { label: "Gastos", value: formatCurrency(stats.totalGastos), icon: Wallet, tono: "neutro" },
  ];
  const esPositivo = gananciaNeta >= 0;

  return (
    <div className="space-y-7">
      <div className="panel-portada">
        <div>
          <h1>Panel de administración</h1>
          <p>Consulta los registros, las ceremonias y los resultados de la operación.</p>
        </div>
      </div>

      <section aria-labelledby="indicadores-admin" className="space-y-3">
        <h2 id="indicadores-admin" className="font-heading text-lg font-semibold">Indicadores de la operación</h2>
        <IndicadoresPanel indicadores={indicadores} />
        <Card className="border-border">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="panel-indicador__icono shrink-0" data-tono={esPositivo ? "exito" : "aviso"}>
                <PiggyBank aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Ganancia neta (ingresos − gastos)</p>
                <p className="break-words font-heading text-2xl font-bold tabular-nums">{formatCurrency(Math.abs(gananciaNeta))}</p>
              </div>
            </div>
            <span className="panel-resultado rounded-md px-3 py-1 text-xs font-semibold"
              data-estado={esPositivo ? "positivo" : "negativo"}>
              {esPositivo ? "Positivo" : "Negativo"}
            </span>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="accesos-admin" className="space-y-3">
        <h2 id="accesos-admin" className="font-heading text-lg font-semibold">Accesos rápidos</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {[
            { id: "colaboradores", label: "Gestionar colaboradores", desc: "Consulta y edita el equipo.", icon: Users },
            { id: "eventos", label: "Gestionar eventos", desc: "Consulta y crea eventos de graduación.", icon: CalendarDays },
            { id: "gastos", label: "Gestionar gastos", desc: "Consulta y registra gastos operativos.", icon: Wallet },
            { id: "registros", label: "Ver registros de graduandos", desc: "Consulta los registros de la operación.", icon: ClipboardList },
          ].map(action => (
            <button key={action.id} type="button" onClick={() => onNavigate(action.id)} className="panel-acceso">
              <span className="panel-indicador__icono shrink-0">
                <action.icon aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{action.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{action.desc}</span>
              </span>
              <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <Recomendaciones />
    </div>
  );
}
