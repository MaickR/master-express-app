import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import { Wallet, Plus, Trash2, Pencil, ReceiptText } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function GestionGastos({ onUpdate }) {
  const [gastos, setGastos] = useState([]);
  const [errorCarga, setErrorCarga] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const activador = useRef(null);
  const nuevoGasto = useRef(null);
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
    setErrorCarga(false);
    try {
      const data = await base44.entities.Gasto.list('-fecha');
      setGastos(data);
    } catch (error) {
      console.error("Error cargando gastos:", error);
      setErrorCarga(true);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ tipo_gasto: "", descripcion: "", valor: "", fecha: new Date().toISOString().split('T')[0] });
    setEditMode(false);
    setEditId(null);
  };

  const openCreate = (evento) => {
    activador.current = evento.currentTarget;
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (gasto, evento) => {
    activador.current = evento.currentTarget;
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
    try {
      await base44.entities.Gasto.delete(gasto.id);
      toast.success("Gasto eliminado");
      loadGastos();
      if (onUpdate) onUpdate();
      nuevoGasto.current?.focus();
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
      <div className="flex items-center justify-center py-12" role="status"><span className="sr-only">Cargando gastos…</span>
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
            Total acumulado: <span className="font-semibold text-foreground">{formatCurrency(totalGastos)}</span>
          </p>
        </div>
        <Button ref={nuevoGasto} onClick={openCreate} className="min-h-11">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-md sm:p-6" onCloseAutoFocus={evento => {
          evento.preventDefault();
          activador.current?.focus();
        }}>
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-foreground" />
              {editMode ? "Editar Gasto" : "Nuevo Gasto"}
            </DialogTitle>
            <DialogDescription>Completa el tipo, el valor y la fecha del gasto.</DialogDescription>
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
            <div className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2">
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
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="outline" className="min-h-11" onClick={() => { setShowDialog(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={guardarGasto} disabled={saving}
                className="min-h-11">
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

      {errorCarga && (
        <div className="panel-estado">
          <p role="alert">No se pudieron consultar los gastos.</p>
          <button type="button" className="panel-accion mx-auto" onClick={() => { setLoading(true); void loadGastos(); }}>Volver a intentar</button>
        </div>
      )}
      {!errorCarga && gastos.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-12 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Sin gastos registrados</h3>
            <p className="text-muted-foreground">Registre su primer gasto</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gastos.map(gasto => (
            <Card key={gasto.id} className="border-border hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-muted rounded-lg flex items-center justify-center">
                      <ReceiptText className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-foreground">{gasto.tipo_gasto}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {gasto.descripcion && <span>{gasto.descripcion}</span>}
                        <span>{formatearFecha(gasto.fecha)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="break-words font-bold text-foreground">{formatCurrency(gasto.valor)}</p>
                    <Button onClick={evento => openEdit(gasto, evento)} variant="ghost" size="icon"
                      aria-label={`Editar gasto ${gasto.tipo_gasto}`} className="size-11 text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Eliminar gasto ${gasto.tipo_gasto}`}
                          className="size-11 text-muted-foreground hover:text-error">
                          <Trash2 aria-hidden="true" className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="p-4 sm:p-6">
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
                          <AlertDialogDescription className="break-words">Se eliminará el gasto «{gasto.tipo_gasto}».</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="min-h-11">Volver</AlertDialogCancel>
                          <AlertDialogAction className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => eliminarGasto(gasto)}>Eliminar gasto</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
