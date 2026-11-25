import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import { CalendarDays, Plus, Trash2, GraduationCap, MapPin, ArrowUpDown } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function GestionEventos({ onUpdate }) {
  const [eventos, setEventos] = useState([]);
  const [ceremonias, setCeremonias] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const creandoEvento = useRef(false);
  const [showNew, setShowNew] = useState(false);
  const [ordenEvento, setOrdenEvento] = useState("proximo"); // proximo | lejano | cronologico
  const [newEvento, setNewEvento] = useState({
    nombre_institucion: "",
    tipo_institucion: "universidad",
    fecha: "",
    lugar: "",
    numero_ceremonias: 1
  });

  useEffect(() => {
    loadEventos();
  }, []);

  const loadEventos = async () => {
    try {
      const data = await base44.entities.Evento.list();
      setEventos(data);
      // Carga de ceremonias en paralelo
      const cerEntries = await Promise.all(
        data.map(ev =>
          base44.entities.Ceremonia.filter({ evento_id: ev.id }).then(cers => [ev.id, cers])
        )
      );
      const cerData = Object.fromEntries(cerEntries);
      setCeremonias(cerData);
    } catch (error) {
      console.error("Error cargando eventos:", error);
    }
    setLoading(false);
  };

  const crearEvento = async () => {
    if (creandoEvento.current) return;
    if (!newEvento.nombre_institucion.trim() || !newEvento.fecha) {
      toast.error("Nombre de institución y fecha son obligatorios");
      return;
    }
    creandoEvento.current = true;
    setSaving(true);
    try {
      const evento = await base44.entities.Evento.create({ ...newEvento, activo: true });
      await Promise.all(
        Array.from({ length: newEvento.numero_ceremonias }, (_, i) =>
          base44.entities.Ceremonia.create({ evento_id: evento.id, nombre: `Ceremonia ${i + 1}`, orden: i + 1 })
        )
      );
      toast.success("Evento creado exitosamente");
      setShowNew(false);
      setNewEvento({ nombre_institucion: "", tipo_institucion: "universidad", fecha: "", lugar: "", numero_ceremonias: 1 });
      loadEventos();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Error al crear evento");
    } finally {
      creandoEvento.current = false;
      setSaving(false);
    }
  };

  const eliminarEvento = async (eventoId) => {
    if (!confirm("¿Eliminar este evento y sus ceremonias?")) return;
    try {
      const cers = ceremonias[eventoId] || [];
      await Promise.all(cers.map(cer => base44.entities.Ceremonia.delete(cer.id)));
      await base44.entities.Evento.delete(eventoId);
      toast.success("Evento eliminado");
      loadEventos();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Error al eliminar evento");
    }
  };

  const formatearFecha = (fecha) => {
    try { return format(parseISO(fecha), "d 'de' MMMM, yyyy", { locale: es }); }
    catch { return fecha; }
  };

  // Ordenamiento dinámico
  const eventosOrdenados = [...eventos].sort((a, b) => {
    const da = new Date(a.fecha || 0).getTime();
    const db = new Date(b.fecha || 0).getTime();
    if (ordenEvento === "proximo") return da - db;
    if (ordenEvento === "lejano") return db - da;
    // cronologico = igual que próximo
    return da - db;
  });

  // Días restantes
  const diasRestantes = (fecha) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ev = new Date(fecha);
    const diff = Math.ceil((ev - hoy) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">Gestión de Eventos</h2>
          <p className="text-muted-foreground text-sm mt-1">{eventos.length} evento(s) configurado(s)</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro de orden */}
          <Select value={ordenEvento} onValueChange={setOrdenEvento}>
            <SelectTrigger className="w-48 h-9">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proximo">Más próximo primero</SelectItem>
              <SelectItem value="lejano">Más lejano primero</SelectItem>
              <SelectItem value="cronologico">Orden cronológico</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                <Plus className="w-4 h-4 mr-2" /> Crear Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Nuevo Evento de Graduación
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="institucion">Nombre de la Institución *</Label>
                  <Input id="institucion" value={newEvento.nombre_institucion}
                    onChange={e => setNewEvento({ ...newEvento, nombre_institucion: e.target.value })}
                    placeholder="Ej. Universidad Nacional" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Institución</Label>
                    <Select value={newEvento.tipo_institucion}
                      onValueChange={v => setNewEvento({ ...newEvento, tipo_institucion: v })}>
                      <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="universidad">Universidad</SelectItem>
                        <SelectItem value="colegio">Colegio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha *</Label>
                    <Input id="fecha" type="date" value={newEvento.fecha}
                      onChange={e => setNewEvento({ ...newEvento, fecha: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lugar">Lugar</Label>
                  <Input id="lugar" value={newEvento.lugar}
                    onChange={e => setNewEvento({ ...newEvento, lugar: e.target.value })}
                    placeholder="Ej. Auditorio Principal" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numCer">Número de Ceremonias</Label>
                  <Select value={String(newEvento.numero_ceremonias)}
                    onValueChange={v => setNewEvento({ ...newEvento, numero_ceremonias: parseInt(v) })}>
                    <SelectTrigger id="numCer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} ceremonia{n > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
                  <Button onClick={crearEvento} disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div> Creando...</>
                    ) : 'Crear Evento'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {eventosOrdenados.length === 0 ? (
          <Card className="border-dashed border-2 border-muted">
            <CardContent className="p-12 text-center">
              <CalendarDays className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Sin eventos registrados</h3>
              <p className="text-muted-foreground">Cree su primer evento de graduación</p>
            </CardContent>
          </Card>
        ) : (
          eventosOrdenados.map(evento => {
            const dias = evento.fecha ? diasRestantes(evento.fecha) : null;
            return (
              <Card key={evento.id} className="border-border/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                        <h3 className="text-lg font-bold text-foreground font-heading">{evento.nombre_institucion}</h3>
                        <Badge className={evento.tipo_institucion === 'universidad' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}>
                          {evento.tipo_institucion}
                        </Badge>
                        {dias !== null && (
                          <Badge className={
                            dias < 0 ? 'bg-muted text-muted-foreground' :
                            dias <= 7 ? 'bg-red-100 text-red-700' :
                            dias <= 30 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }>
                            {dias < 0 ? `Hace ${Math.abs(dias)} días` : dias === 0 ? 'Hoy' : `En ${dias} días`}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{formatearFecha(evento.fecha)}</span>
                        {evento.lugar && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {evento.lugar}
                          </span>
                        )}
                      </div>
                      {(ceremonias[evento.id] || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[...(ceremonias[evento.id] || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(cer => (
                            <Badge key={cer.id} variant="outline" className="text-xs">
                              {cer.nombre} {cer.hora ? `(${cer.hora})` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button onClick={() => eliminarEvento(evento.id)} variant="ghost" size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
