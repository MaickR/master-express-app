import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardList, Search, GraduationCap, CheckCircle, AlertCircle, Image, User, ChevronDown, ChevronUp, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const paqueteLabels = { digital: 'Digital', fisico: 'Físico', fisico_digital: 'Físico + Digital' };
const medioPagoLabels = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', tarjeta: 'Tarjeta', otro: 'Otro' };

// ─── Diálogo de confirmación de eliminación con credenciales ─────────────────
function EliminarDialog({ graduando, onConfirm, onCancel }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setError("");
    setLoading(true);
    try {
      const admins = await base44.entities.Administrador.filter({ username: usuario });
      const admin = admins.find(a => a.password === password);
      if (!admin) {
        setError("Credenciales incorrectas. Inténtalo de nuevo.");
        setLoading(false);
        return;
      }
    } catch (e) {
      setError("Error al verificar credenciales.");
      setLoading(false);
      return;
    }
    setLoading(false);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-border">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">¿Eliminar este graduando?</h3>
              <p className="text-sm text-muted-foreground">El registro se enviará a la papelera por 5 días.</p>
            </div>
          </div>
          <p className="text-sm text-foreground font-medium bg-muted/40 rounded-lg px-3 py-2">
            {graduando.nombre_completo}
          </p>
          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-sm font-medium text-foreground">Ingresa tus credenciales de administrador:</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Usuario</label>
              <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="usuario" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Contraseña</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleConfirm()} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={loading || !usuario || !password}
              className="flex-1 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Enviar a papelera
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);

// Fila de reporte con puntos rellenos
function ReportRow({ label, value, valueCls = "" }) {
  return (
    <div className="flex items-baseline gap-1 text-sm">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <span className="flex-1 border-b border-dotted border-border mx-1" style={{ minWidth: 20 }}></span>
      <span className={`font-semibold text-foreground whitespace-nowrap ${valueCls}`}>{value}</span>
    </div>
  );
}

function GraduandoCard({ g, col, index, onEliminar }) {
  const [expanded, setExpanded] = useState(false);
  const isEven = index % 2 === 0;

  return (
    <Card className={`border-border/50 hover:shadow-md transition-shadow ${isEven ? 'bg-card' : 'bg-muted/30'}`}>
      <CardContent className="p-4 lg:p-5">
        {/* Vista principal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-xl font-bold text-primary font-heading leading-tight">
              {g.nombre_completo}
            </h4>
            <div className="mt-1 space-y-0.5">
              {g.direccion && <p className="text-sm text-muted-foreground">{g.direccion}</p>}
              {g.programa_academico && <p className="text-sm text-muted-foreground">{g.programa_academico}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:text-primary/80 hover:bg-primary/5 gap-1"
            >
              {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Ocultar</> : <><ChevronDown className="w-3.5 h-3.5" />Ver más</>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEliminar(g)}
              className="text-destructive/60 hover:text-destructive hover:bg-destructive/5 h-8 w-8 p-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Detalle expandible */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-5">

            {/* Información personal — 2 columnas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {/* Columna izquierda */}
              <div className="space-y-1.5">
                {g.telefono && (
                  <div>
                    <span className="font-bold text-foreground">Número de teléfono</span>
                    <p className="text-muted-foreground">{g.telefono}</p>
                  </div>
                )}
                {g.direccion && (
                  <div>
                    <span className="font-bold text-foreground">Dirección</span>
                    <p className="text-muted-foreground">{g.direccion}</p>
                  </div>
                )}
                {g.barrio && (
                  <div>
                    <span className="font-bold text-foreground">Barrio</span>
                    <p className="text-muted-foreground">{g.barrio}</p>
                  </div>
                )}
                {g.ciudad && (
                  <div>
                    <span className="font-bold text-foreground">Ciudad</span>
                    <p className="text-muted-foreground">{g.ciudad}</p>
                  </div>
                )}
              </div>
              {/* Columna derecha */}
              <div className="space-y-1.5">
                {g.correo && (
                  <div>
                    <span className="font-bold text-foreground">Correo electrónico</span>
                    <p className="text-muted-foreground">{g.correo}</p>
                  </div>
                )}
                {col && (
                  <div>
                    <span className="font-bold text-foreground">Registrado por</span>
                    <p className="text-muted-foreground">{col.nombre_completo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Información financiera — estilo reporte con puntos */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-2">
              <ReportRow label="Paquete adquirido" value={paqueteLabels[g.paquete] || g.paquete} />
              <ReportRow label="Valor total" value={formatCurrency(g.valor_total)} valueCls="text-foreground" />
              <ReportRow label="Abono" value={formatCurrency(g.abono)} valueCls="text-green-600" />
              <ReportRow
                label="Saldo pendiente"
                value={formatCurrency(g.saldo)}
                valueCls={(g.saldo || 0) > 0 ? "text-amber-600" : "text-green-600"}
              />
              {g.medio_pago && <ReportRow label="Medio de pago" value={medioPagoLabels[g.medio_pago] || g.medio_pago} />}
              <div className="flex items-baseline gap-1 text-sm pt-1 border-t border-border/30">
                <span className="text-muted-foreground whitespace-nowrap">Estado de pago</span>
                <span className="flex-1 border-b border-dotted border-border mx-1" style={{ minWidth: 20 }}></span>
                <Badge className={`text-xs ${g.estado_pago === 'completo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {g.estado_pago === 'completo'
                    ? <><CheckCircle className="w-3 h-3 mr-1" />COMPLETO</>
                    : <><AlertCircle className="w-3 h-3 mr-1" />PENDIENTE</>}
                </Badge>
              </div>
            </div>

            {/* Comprobantes */}
            {(g.comprobante_urls || g.foto_urls)?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">Comprobantes de pago</p>
                <div className="flex flex-wrap gap-1.5">
                  {(g.comprobante_urls || g.foto_urls).map((url, i) => (
                    <Button key={i} variant="outline" size="sm"
                      onClick={() => window.open(url, '_blank')}
                      className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50">
                      <Image className="w-3 h-3 mr-1" />Comp. {i + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TodosRegistros() {
  const [graduandos, setGraduandos] = useState([]);
  const [colaboradoresMap, setColaboradoresMap] = useState({});
  const [eventos, setEventos] = useState([]);
  const [ceremoniasMap, setCeremonjasMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroPago, setFiltroPago] = useState("todos");
  const [filtroColaborador, setFiltroColaborador] = useState("todos");
  const [filtroEvento, setFiltroEvento] = useState("todos");
  const [filtroCeremonia, setFiltroCeremonia] = useState("todos");
  const [pendienteEliminar, setPendienteEliminar] = useState(null);

  useEffect(() => {
    loadData();
    // Sincronización en tiempo real
    const unsub = base44.entities.Graduando.subscribe((event) => {
      if (event.type === "update" && event.data) {
        if (event.data.eliminado) {
          setGraduandos(prev => prev.filter(g => g.id !== event.data.id));
        } else if (event.data.eliminado === false) {
          setGraduandos(prev => prev.find(g => g.id === event.data.id)
            ? prev.map(g => g.id === event.data.id ? event.data : g)
            : [event.data, ...prev]);
        } else {
          setGraduandos(prev => prev.map(g => g.id === event.data.id ? event.data : g));
        }
      }
      if (event.type === "create" && event.data && !event.data.eliminado) {
        setGraduandos(prev => [event.data, ...prev]);
      }
      if (event.type === "delete") {
        setGraduandos(prev => prev.filter(g => g.id !== event.id));
      }
    });
    return () => unsub();
  }, []);

  const handleEliminar = (g) => setPendienteEliminar(g);

  const confirmarEliminar = async () => {
    if (!pendienteEliminar) return;
    await base44.entities.Graduando.update(pendienteEliminar.id, {
      eliminado: true,
      fecha_eliminacion: new Date().toISOString(),
    });
    setGraduandos(prev => prev.filter(x => x.id !== pendienteEliminar.id));
    setPendienteEliminar(null);
  };

  const loadData = async () => {
    try {
      const [grads, cols, evs, cers] = await Promise.all([
        base44.entities.Graduando.list('-created_date'),
        base44.entities.Colaborador.list(),
        base44.entities.Evento.list('-fecha'),
        base44.entities.Ceremonia.list()
      ]);
      // Excluir eliminados (en papelera) de la vista activa
      setGraduandos(grads.filter(g => !g.eliminado));
      const map = {};
      cols.forEach(c => { map[c.id] = c; });
      setColaboradoresMap(map);
      setEventos(evs);
      // Group ceremonies by evento_id
      const cerMap = {};
      cers.forEach(c => {
        if (!cerMap[c.evento_id]) cerMap[c.evento_id] = [];
        cerMap[c.evento_id].push(c);
      });
      // Sort each group ascending by orden
      Object.keys(cerMap).forEach(k => cerMap[k].sort((a, b) => (a.orden || 0) - (b.orden || 0)));
      setCeremonjasMap(cerMap);
    } catch (error) { console.error("Error cargando registros:", error); }
    setLoading(false);
  };

  // Reset ceremony filter when event changes
  const handleFiltroEvento = (val) => {
    setFiltroEvento(val);
    setFiltroCeremonia("todos");
  };

  const ceremoniasDelEvento = filtroEvento !== "todos" ? (ceremoniasMap[filtroEvento] || []) : [];

  const filtrados = graduandos.filter(g => {
    const matchBusqueda = !busqueda ||
      g.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      g.telefono?.includes(busqueda) ||
      g.ciudad?.toLowerCase().includes(busqueda.toLowerCase());
    const matchPago = filtroPago === 'todos' || g.estado_pago === filtroPago;
    const matchCol = filtroColaborador === 'todos' || g.colaborador_id === filtroColaborador;
    const matchEvento = filtroEvento === 'todos' || g.evento_id === filtroEvento;
    const matchCeremonia = filtroCeremonia === 'todos' || g.ceremonia_id === filtroCeremonia;
    return matchBusqueda && matchPago && matchCol && matchEvento && matchCeremonia;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading">Registros de Graduandos</h2>
        <p className="text-muted-foreground text-sm mt-1">{graduandos.length} graduando(s) registrado(s)</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Buscar por nombre, teléfono o ciudad..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} className="pl-10" />
        </div>
        <Select value={filtroEvento} onValueChange={handleFiltroEvento}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Todos los eventos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los eventos</SelectItem>
            {eventos.map(ev => (
              <SelectItem key={ev.id} value={ev.id}>
                {ev.nombre_institucion} — {ev.fecha}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtroEvento !== "todos" && (
          <Select value={filtroCeremonia} onValueChange={setFiltroCeremonia}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas las ceremonias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las ceremonias</SelectItem>
              {ceremoniasDelEvento.map(cer => (
                <SelectItem key={cer.id} value={cer.id}>{cer.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filtroPago} onValueChange={setFiltroPago}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado pago" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="completo">Completos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.values(colaboradoresMap).map(col => (
              <SelectItem key={col.id} value={col.id}>{col.nombre_completo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-12 text-center">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">No se encontraron registros</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map((g, i) => (
            <GraduandoCard key={g.id} g={g} col={colaboradoresMap[g.colaborador_id]} index={i} onEliminar={handleEliminar} />
          ))}
        </div>
      )}

      {pendienteEliminar && (
        <EliminarDialog
          graduando={pendienteEliminar}
          onConfirm={confirmarEliminar}
          onCancel={() => setPendienteEliminar(null)}
        />
      )}
    </div>
  );
}