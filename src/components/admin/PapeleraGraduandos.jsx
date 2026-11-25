import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, RotateCcw, AlertTriangle, Loader2, Trash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const CINCO_DIAS_MS = 5 * 24 * 60 * 60 * 1000;

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }) : "—";

function diasRestantes(fechaEliminacion) {
  if (!fechaEliminacion) return 0;
  const diff = CINCO_DIAS_MS - (Date.now() - new Date(fechaEliminacion).getTime());
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// Diálogo de confirmación con credenciales admin
function ConfirmDialog({ titulo, mensaje, requiereCreds, onConfirm, onCancel }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (requiereCreds) {
      setLoading(true);
      setError("");
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
    }
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
              <h3 className="font-bold text-foreground text-lg">{titulo}</h3>
              <p className="text-sm text-muted-foreground">{mensaje}</p>
            </div>
          </div>

          {requiereCreds && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-medium text-foreground">Ingresa tus credenciales de administrador para continuar:</p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Usuario</label>
                <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="usuario" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contraseña</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={loading}
              className="flex-1 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Confirmar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PapeleraGraduandos() {
  const [eliminados, setEliminados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { tipo: 'permanente', graduando }

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
      // Auto-purgar los que llevan más de 5 días
      const ahora = Date.now();
      const aPurgar = todos.filter(g => {
        if (!g.fecha_eliminacion) return false;
        return ahora - new Date(g.fecha_eliminacion).getTime() > CINCO_DIAS_MS;
      });
      if (aPurgar.length > 0) {
        await Promise.all(aPurgar.map(g => base44.entities.Graduando.delete(g.id)));
      }
      const restantes = todos.filter(g => !aPurgar.find(p => p.id === g.id));
      setEliminados(restantes);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const restaurar = async (g) => {
    await base44.entities.Graduando.update(g.id, { eliminado: false, fecha_eliminacion: null });
    setEliminados(prev => prev.filter(x => x.id !== g.id));
  };

  const eliminarDefinitivo = async (g) => {
    await base44.entities.Graduando.delete(g.id);
    setEliminados(prev => prev.filter(x => x.id !== g.id));
    setConfirm(null);
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
          Los registros permanecen aquí 5 días antes de eliminarse automáticamente.
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
          {eliminados.map(g => {
            const dias = diasRestantes(g.fecha_eliminacion);
            return (
              <Card key={g.id} className="border-border/50">
                <CardContent className="p-4 lg:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-foreground">{g.nombre_completo}</h4>
                        <Badge className={`text-xs ${dias <= 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {dias === 0 ? "Se elimina hoy" : `${dias} día(s) restantes`}
                        </Badge>
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
                      <Button size="sm" variant="destructive" onClick={() => setConfirm({ g })}
                        className="gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          titulo="Eliminar definitivamente"
          mensaje={`¿Estás seguro de que deseas eliminar permanentemente a "${confirm.g.nombre_completo}"? Esta acción es irreversible y no podrá recuperarse.`}
          requiereCreds={false}
          onConfirm={() => eliminarDefinitivo(confirm.g)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}