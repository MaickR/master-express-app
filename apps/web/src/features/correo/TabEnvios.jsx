import React, { useState, useEffect } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import { Send, Filter, X, Loader2, CheckCircle, AlertCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { buildEmailHTML, DEFAULT_SUBJECTS, EMAIL_LABELS, EMAIL_TYPES, sendEmail } from "@/integrations/emailjs/emailService";

export default function TabEnvios() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const [graduandos, setGraduandos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [ceremonias, setCeremonias] = useState([]);

  // Filtros
  const [tipoCorreo, setTipoCorreo] = useState(EMAIL_TYPES.REGISTRO_GRADUANDO);
  const [filtroEvento, setFiltroEvento] = useState("todos");
  const [filtroCeremonia, setFiltroCeremonia] = useState("todos");
  const [filtroCarrera, setFiltroCarrera] = useState("todos");
  const [filtroPago, setFiltroPago] = useState("todos");
  const [filtroPaquete, setFiltroPaquete] = useState("todos");
  // Modo envío individual
  const [modoIndividual, setModoIndividual] = useState(false);
  const [correoIndividual, setCorreoIndividual] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [grads, evs, cers] = await Promise.all([
      base44.entities.Graduando.list(),
      base44.entities.Evento.list(),
      base44.entities.Ceremonia.list(),
    ]);
    setGraduandos(grads.filter(g => !g.eliminado));
    setEventos(evs);
    setCeremonias(cers);
    setLoading(false);
  };

  const carreras = [...new Set(graduandos.map(g => g.programa_academico).filter(Boolean))].sort();

  const ceremoniasFiltradas = filtroEvento === "todos"
    ? ceremonias
    : ceremonias.filter(c => c.evento_id === filtroEvento);

  const eventoMap = Object.fromEntries(eventos.map(e => [e.id, e]));
  const ceremoniaMap = Object.fromEntries(ceremonias.map(c => [c.id, c]));

  const destinatariosFiltrados = graduandos.filter(g => {
    if (!g.correo) return false;
    if (filtroEvento !== "todos" && g.evento_id !== filtroEvento) return false;
    if (filtroCeremonia !== "todos" && g.ceremonia_id !== filtroCeremonia) return false;
    if (filtroCarrera !== "todos" && g.programa_academico !== filtroCarrera) return false;
    if (filtroPago !== "todos" && g.estado_pago !== filtroPago) return false;
    if (filtroPaquete !== "todos" && g.paquete !== filtroPaquete) return false;
    return true;
  });

  const limpiarFiltros = () => {
    setFiltroEvento("todos"); setFiltroCeremonia("todos");
    setFiltroCarrera("todos"); setFiltroPago("todos"); setFiltroPaquete("todos");
  };

  const handleEnviar = async () => {
    setSending(true);
    setResult(null);

    const [ejsRows, cfgRows] = await Promise.all([
      base44.entities.EmailJSConfig.list(),
      base44.entities.EmailConfig.filter({ tipo: tipoCorreo }),
    ]);
    const ejsConfig = ejsRows[0] || {};
    const cfg = cfgRows[0] || {};

    if (!ejsConfig.service_id) {
      setResult({ ok: false, msg: "EmailJS no está configurado.", total: 0, exitosos: 0 });
      setSending(false);
      return;
    }

    let listaEnvio = [];

    if (modoIndividual) {
      if (!correoIndividual.trim()) {
        setResult({ ok: false, msg: "Ingresa un correo electrónico.", total: 0, exitosos: 0 });
        setSending(false);
        return;
      }
      listaEnvio = [{ correo: correoIndividual.trim(), nombre_completo: "Destinatario" }];
    } else {
      listaEnvio = destinatariosFiltrados;
    }

    let exitosos = 0;
    let errores = 0;

    for (const g of listaEnvio) {
      const asunto = cfg.asunto || DEFAULT_SUBJECTS[tipoCorreo] || "Mensaje de Master Express Eventos";
      const html_body = buildEmailHTML(tipoCorreo, {
        nombre: g.nombre_completo,
        telefono: g.telefono,
        correo: g.correo,
        direccion: g.direccion,
        barrio: g.barrio,
        ciudad: g.ciudad,
        programa_academico: g.programa_academico,
        paquete: g.paquete,
        valor_total: g.valor_total,
        abono: g.abono,
        saldo: g.saldo,
        medio_pago: g.medio_pago,
        fecha: g.fecha,
        evento: eventoMap[g.evento_id]?.nombre_institucion || "",
        ceremonia: ceremoniaMap[g.ceremonia_id]?.nombre || "",
      }, cfg);

      try {
        await sendEmail({
          to_email: g.correo,
          to_name: g.nombre_completo,
          subject: asunto,
          html_body,
          tipo: tipoCorreo,
          graduando_id: g.id,
          ejsConfig,
        });
        exitosos++;
      } catch {
        errores++;
      }
    }

    setResult({ ok: errores === 0, total: listaEnvio.length, exitosos, errores });
    setSending(false);
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-bold text-foreground font-heading mb-1">Envíos</h3>
        <p className="text-sm text-muted-foreground">Envía correos a graduandos usando filtros o directamente a un destinatario.</p>
      </div>

      {/* Tipo de correo */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Tipo de Correo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <select value={tipoCorreo} onChange={e => setTipoCorreo(e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            {Object.values(EMAIL_TYPES).map(t => (
              <option key={t} value={t}>{EMAIL_LABELS[t]}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Modo envío */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Modalidad de Envío
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex gap-3">
            <button
              onClick={() => setModoIndividual(false)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                !modoIndividual ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground hover:bg-muted'
              }`}>
              Grupo filtrado
            </button>
            <button
              onClick={() => setModoIndividual(true)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                modoIndividual ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground hover:bg-muted'
              }`}>
              Destinatario único
            </button>
          </div>

          {modoIndividual && (
            <div>
              <Label className="text-xs font-medium mb-1 block">Correo del destinatario</Label>
              <Input
                type="email"
                value={correoIndividual}
                onChange={e => setCorreoIndividual(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros (solo en modo grupo) */}
      {!modoIndividual && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" /> Filtros
              </CardTitle>
              <button onClick={limpiarFiltros} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="w-3 h-3" /> Limpiar
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Evento</Label>
              <Select value={filtroEvento} onValueChange={v => { setFiltroEvento(v); setFiltroCeremonia("todos"); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los eventos</SelectItem>
                  {eventos.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_institucion}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Ceremonia</Label>
              <Select value={filtroCeremonia} onValueChange={setFiltroCeremonia}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las ceremonias</SelectItem>
                  {ceremoniasFiltradas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Carrera / Programa</Label>
              <Select value={filtroCarrera} onValueChange={setFiltroCarrera}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las carreras</SelectItem>
                  {carreras.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Estado de pago</Label>
              <Select value={filtroPago} onValueChange={setFiltroPago}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="completo">Pago completo</SelectItem>
                  <SelectItem value="pendiente">Saldo pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-medium">Paquete adquirido</Label>
              <Select value={filtroPaquete} onValueChange={setFiltroPaquete}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los paquetes</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="fisico">Físico</SelectItem>
                  <SelectItem value="fisico_digital">Físico + Digital</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen y botón enviar */}
      <div className="space-y-3">
        {!modoIndividual && (
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
            <Users className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                <span className="text-primary text-lg font-bold">{destinatariosFiltrados.length}</span> destinatario(s) con correo registrado
              </p>
              <p className="text-xs text-muted-foreground">De {graduandos.filter(g => !g.eliminado).length} graduandos activos</p>
            </div>
          </div>
        )}

        <Button
          onClick={handleEnviar}
          disabled={sending || (!modoIndividual && destinatariosFiltrados.length === 0)}
          className="w-full gap-2"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? `Enviando...` : `Enviar correo${!modoIndividual && destinatariosFiltrados.length > 1 ? ` (${destinatariosFiltrados.length})` : ""}`}
        </Button>

        {result && (
          <div className={`flex items-start gap-3 p-4 rounded-xl text-sm border ${result.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            {result.ok ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
            <div>
              {result.msg ? (
                <p>{result.msg}</p>
              ) : (
                <>
                  <p className="font-semibold">{result.ok ? "Envío completado" : "Envío con errores"}</p>
                  <p className="text-xs mt-0.5">{result.exitosos} de {result.total} correos enviados exitosamente{result.errores > 0 ? ` · ${result.errores} fallidos` : ""}.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}