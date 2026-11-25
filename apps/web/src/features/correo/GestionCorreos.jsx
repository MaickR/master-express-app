import React, { useState, useEffect } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import {
  Mail, Settings, Send, History, CheckCircle, AlertCircle,
  Save, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { DEFAULT_SUBJECTS, DEFAULT_SALUDO, DEFAULT_MENSAJE_FINAL, EMAIL_LABELS, EMAIL_TYPES } from "@/integrations/emailjs/emailService";
import TabEnvios from "@/features/correo/TabEnvios";

const TIPOS = Object.values(EMAIL_TYPES);

const formatDate = (d) =>
  d ? new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";

// ─── Tab: Configuración EmailJS ───────────────────────────────────────────────
function TabEmailJS() {
  const [cfg, setCfg] = useState({ service_id: "", template_id: "", public_key: "", correo_remitente: "", nombre_remitente: "Master Express Eventos" });
  const [cfgId, setCfgId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    base44.entities.EmailJSConfig.list().then(rows => {
      if (rows[0]) { setCfg(rows[0]); setCfgId(rows[0].id); }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    if (cfgId) {
      await base44.entities.EmailJSConfig.update(cfgId, cfg);
    } else {
      const created = await base44.entities.EmailJSConfig.create(cfg);
      setCfgId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-bold text-foreground font-heading mb-1">Credenciales EmailJS</h3>
        <p className="text-sm text-muted-foreground">Ingresa los datos de tu cuenta EmailJS para habilitar el envío de correos.</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-5 space-y-4">
          {[
            { key: "service_id", label: "Service ID", placeholder: "service_xxxxxxx" },
            { key: "template_id", label: "Template ID", placeholder: "template_xxxxxxx" },
            { key: "correo_remitente", label: "Correo Remitente", placeholder: "notificaciones@example.com" },
            { key: "nombre_remitente", label: "Nombre Remitente", placeholder: "Master Express Eventos" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium text-foreground mb-1 block">{f.label}</label>
              <Input value={cfg[f.key] || ""} onChange={e => setCfg(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} />
            </div>
          ))}

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Public Key</label>
            <div className="relative">
              <Input type={showKey ? "text" : "password"} value={cfg.public_key || ""}
                onChange={e => setCfg(p => ({ ...p, public_key: e.target.value }))}
                placeholder="xxxxxxxxxxxxxxxx" className="pr-10" />
              <button onClick={() => setShowKey(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "¡Guardado!" : "Guardar configuración"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">📋 Plantilla EmailJS requerida</p>
          <p>En tu cuenta de EmailJS, crea una plantilla con estas variables:</p>
          <ul className="list-disc list-inside space-y-1 text-xs font-mono bg-amber-100 p-3 rounded-lg">
            <li>{"{{to_email}}"} — correo del destinatario</li>
            <li>{"{{to_name}}"} — nombre del destinatario</li>
            <li>{"{{subject}}"} — asunto del correo</li>
            <li>{"{{html_body}}"} — cuerpo HTML del correo</li>
            <li>{"{{from_name}}"} — nombre del remitente</li>
          </ul>
          <p className="text-xs">El cuerpo de la plantilla debe ser: <code className="bg-amber-100 px-1 rounded">{"{{html_body}}"}</code></p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Tipos de Correo ─────────────────────────────────────────────────────
function TabTipos() {
  const [configs, setConfigs] = useState({});
  const [saving, setSaving] = useState({});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    const rows = await base44.entities.EmailConfig.list();
    const map = {};
    rows.forEach(r => { map[r.tipo] = r; });
    TIPOS.forEach(t => {
      if (!map[t]) map[t] = {
        tipo: t, activo: true,
        asunto: DEFAULT_SUBJECTS[t] || "",
        saludo: DEFAULT_SALUDO[t] || "",
        mensaje_final: DEFAULT_MENSAJE_FINAL[t] || "",
        texto_adicional: "", firma: ""
      };
    });
    setConfigs(map);
  };

  const handleSave = async (tipo) => {
    setSaving(s => ({ ...s, [tipo]: true }));
    const entry = configs[tipo];
    if (entry.id) {
      await base44.entities.EmailConfig.update(entry.id, entry);
    } else {
      const created = await base44.entities.EmailConfig.create(entry);
      setConfigs(p => ({ ...p, [tipo]: created }));
    }
    setSaving(s => ({ ...s, [tipo]: false }));
  };

  const update = (tipo, field, val) => setConfigs(p => ({ ...p, [tipo]: { ...p[tipo], [field]: val } }));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-foreground font-heading mb-1">Plantillas de Correo</h3>
        <p className="text-sm text-muted-foreground">Todo el contenido que configures aquí se enviará en el correo. Los cambios se aplican a todos los envíos posteriores.</p>
      </div>
      {TIPOS.map(tipo => {
        const cfg = configs[tipo] || {};
        const isOpen = expanded === tipo;
        return (
          <Card key={tipo} className="border-border/50">
            <CardContent className="p-0">
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-xl"
                onClick={() => setExpanded(isOpen ? null : tipo)}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${cfg.activo !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="font-medium text-foreground">{EMAIL_LABELS[tipo]}</span>
                  {cfg.activo === false && <Badge variant="outline" className="text-xs text-muted-foreground">Desactivado</Badge>}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">Activo</span>
                    <button onClick={() => update(tipo, "activo", !(cfg.activo !== false))}
                      className={`relative inline-flex h-5 w-10 rounded-full transition-colors ${cfg.activo !== false ? 'bg-primary' : 'bg-muted'}`}>
                      <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5 ${cfg.activo !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Asunto del correo</label>
                    <Input value={cfg.asunto || ""} onChange={e => update(tipo, "asunto", e.target.value)}
                      placeholder={DEFAULT_SUBJECTS[tipo]} />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Saludo / Cuerpo principal</label>
                    <p className="text-xs text-muted-foreground mb-1.5">Texto que aparece justo después del nombre del destinatario. Describe el motivo del correo.</p>
                    <textarea value={cfg.saludo || ""} onChange={e => update(tipo, "saludo", e.target.value)}
                      placeholder={DEFAULT_SALUDO[tipo] || ""}
                      rows={3}
                      className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Mensaje final / Aviso</label>
                    <p className="text-xs text-muted-foreground mb-1.5">Aparece al pie del contenido, en el recuadro azul. Ideal para instrucciones o avisos importantes.</p>
                    <textarea value={cfg.mensaje_final !== undefined ? cfg.mensaje_final : (DEFAULT_MENSAJE_FINAL[tipo] || "")}
                      onChange={e => update(tipo, "mensaje_final", e.target.value)}
                      placeholder={DEFAULT_MENSAJE_FINAL[tipo] || "Ej: Si tiene alguna duda, comuníquese con nosotros."}
                      rows={2}
                      className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Texto adicional</label>
                    <p className="text-xs text-muted-foreground mb-1.5">Texto extra que aparece al final del correo, antes de la firma.</p>
                    <textarea value={cfg.texto_adicional || ""} onChange={e => update(tipo, "texto_adicional", e.target.value)}
                      placeholder="Texto adicional opcional..."
                      rows={2}
                      className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Firma</label>
                    <Input value={cfg.firma || ""} onChange={e => update(tipo, "firma", e.target.value)}
                      placeholder="Ej: El equipo de Master Express Eventos" />
                  </div>

                  <Button size="sm" onClick={() => handleSave(tipo)} disabled={saving[tipo]} className="gap-2">
                    {saving[tipo] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar plantilla
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}



// ─── Tab: Historial ───────────────────────────────────────────────────────────
function TabHistorial() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.EmailLog.list("-created_date", 100).then(rows => {
      setLogs(rows);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    await base44.entities.EmailLog.delete(id);
    setLogs(p => p.filter(l => l.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground font-heading mb-1">Historial de Correos</h3>
          <p className="text-sm text-muted-foreground">{logs.length} registro(s) encontrado(s)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-10 text-center">
            <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">No hay correos enviados aún</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log, i) => (
            <Card key={log.id} className={`border-border/40 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{EMAIL_LABELS[log.tipo] || log.tipo}</Badge>
                      <Badge className={`text-xs ${log.estado === 'enviado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {log.estado === 'enviado' ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : <AlertCircle className="w-3 h-3 mr-1 inline" />}
                        {log.estado}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{log.asunto}</p>
                    <p className="text-xs text-muted-foreground">{log.nombre_destinatario ? `${log.nombre_destinatario} — ` : ""}{log.destinatario}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.created_date)}</p>
                    {log.error && <p className="text-xs text-red-600">{log.error}</p>}
                  </div>
                  <button onClick={() => handleDelete(log.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const SUBTABS = [
  { id: "emailjs",   label: "Configuración EmailJS", icon: Settings },
  { id: "tipos",     label: "Plantillas",             icon: Mail },
  { id: "envios",    label: "Envíos",                 icon: Send },
  { id: "historial", label: "Historial",              icon: History },
];

export default function GestionCorreos() {
  const [activeTab, setActiveTab] = useState("emailjs");

  const renderTab = () => {
    switch (activeTab) {
      case "emailjs":   return <TabEmailJS />;
      case "tipos":     return <TabTipos />;
      case "envios":    return <TabEnvios />;
      case "historial": return <TabHistorial />;
      default:          return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading">Correos Electrónicos</h2>
        <p className="text-muted-foreground text-sm mt-1">Configura y gestiona el sistema de correos automáticos.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {SUBTABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}