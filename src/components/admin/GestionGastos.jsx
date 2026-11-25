import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wallet, Plus, Trash2, Pencil, ReceiptText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function GestionGastos({ onUpdate }) {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    tipo_gasto: "",
    descripcion: "",
    valor: "",
    fecha: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadGastos();
  }, []);

  const loadGastos = async () => {
    try {
      const data = await base44.entities.Gasto.list('-fecha');
      setGastos(data);
    } catch (error) {
      console.error("Error cargando gastos:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ tipo_gasto: "", descripcion: "", valor: "", fecha: new Date().toISOString().split('T')[0] });
    setEditMode(false);
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (gasto) => {
    setForm({
      tipo_gasto: gasto.tipo_gasto || "",
      descripcion: gasto.descripcion || "",
      valor: String(gasto.valor || ""),
      fecha: gasto.fecha || new Date().toISOString().split('T')[0]
    });
    setEditMode(true);
    setEditId(gasto.id);
    setShowDialog(true);
  };

  const guardarGasto = async () => {
    if (!form.tipo_gasto.trim()) {
      toast.error("El tipo de gasto es obligatorio");
      return;
    }
    if (!form.valor || Number(form.valor) <= 0) {
      toast.error("El valor debe ser mayor a 0");
      return;
    }

    setSaving(true);
    try {
      const data = { ...form, valor: Number(form.valor) };
      if (editMode) {
        await base44.entities.Gasto.update(editId, data);
        toast.success("Gasto actualizado exitosamente");
      } else {
        await base44.entities.Gasto.create(data);
        toast.success("Gasto registrado exitosamente");
      }
      setShowDialog(false);
      resetForm();
      loadGastos();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Error al guardar gasto");
    }
    setSaving(false);
  };

  const eliminarGasto = async (gasto) => {
    if (!confirm(`¿Eliminar gasto "${gasto.tipo_gasto}"?`)) return;
    try {
      await base44.entities.Gasto.delete(gasto.id);
      toast.success("Gasto eliminado");
      loadGastos();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Error al eliminar gasto");
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  };

  const totalGastos = gastos.reduce((sum, g) => sum + (g.valor || 0), 0);

  const formatearFecha = (fecha) => {
    try {
      return format(parseISO(fecha), "d 'de' MMM, yyyy", { locale: es });
    } catch {
      return fecha;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">Gastos</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Total acumulado: <span className="font-semibold text-accent">{formatCurrency(totalGastos)}</span>
          </p>
        </div>
        <Button onClick={openCreate} className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-md">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-accent" />
              {editMode ? "Editar Gasto" : "Nuevo Gasto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_gasto">Tipo de gasto *</Label>
              <Input id="tipo_gasto" value={form.tipo_gasto}
                onChange={e => setForm({...form, tipo_gasto: e.target.value})}
                placeholder="Ej. Transporte, Alimentación, Papelería..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input id="descripcion" value={form.descripcion}
                onChange={e => setForm({...form, descripcion: e.target.value})}
                placeholder="Detalle del gasto" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (COP) *</Label>
                <Input id="valor" type="number" min="0" step="1000"
                  value={form.valor}
                  onChange={e => setForm({...form, valor: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <Input id="fecha" type="date" value={form.fecha}
                  onChange={e => setForm({...form, fecha: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={guardarGasto} disabled={saving}
                className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin mr-2"></div> Guardando...</>
                ) : (
                  editMode ? 'Actualizar Gasto' : 'Registrar Gasto'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {gastos.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-12 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Sin gastos registrados</h3>
            <p className="text-muted-foreground">Registre su primer gasto</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gastos.map(gasto => (
            <Card key={gasto.id} className="border-border/50 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                      <ReceiptText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{gasto.tipo_gasto}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {gasto.descripcion && <span>{gasto.descripcion}</span>}
                        <span>{formatearFecha(gasto.fecha)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-accent">{formatCurrency(gasto.valor)}</p>
                    <Button onClick={() => openEdit(gasto)} variant="ghost" size="icon"
                      className="text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => eliminarGasto(gasto)} variant="ghost" size="icon"
                      className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}