import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, Save, Package, Plus, Edit2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function GestionPrecios({ onUpdate }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [precios, setPrecios] = useState({ precio_digital: 50000, precio_fisico: 100000, precio_fisico_digital: 120000 });
  const [paquetes, setPaquetes] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editandoPaquete, setEditandoPaquete] = useState(null);
  const [savingPaquete, setSavingPaquete] = useState(false);
  const [formPaquete, setFormPaquete] = useState({ nombre: "", descripcion: "", precio: "" });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [configs, pkgs] = await Promise.all([
        base44.entities.Configuracion.list(),
        base44.entities.PaquetePersonalizado.list()
      ]);
      if (configs.length > 0) {
        setConfig(configs[0]);
        setPrecios({
          precio_digital: configs[0].precio_digital || 50000,
          precio_fisico: configs[0].precio_fisico || 100000,
          precio_fisico_digital: configs[0].precio_fisico_digital || 120000
        });
      }
      setPaquetes(pkgs);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const guardarPrecios = async () => {
    setSaving(true);
    try {
      if (config) {
        await base44.entities.Configuracion.update(config.id, precios);
      } else {
        await base44.entities.Configuracion.create(precios);
      }
      toast.success("Precios actualizados correctamente");
      if (onUpdate) onUpdate();
      loadAll();
    } catch (e) { toast.error("Error al guardar precios"); }
    setSaving(false);
  };

  const openCreate = () => {
    setEditandoPaquete(null);
    setFormPaquete({ nombre: "", descripcion: "", precio: "" });
    setShowDialog(true);
  };

  const openEdit = (pkg) => {
    setEditandoPaquete(pkg);
    setFormPaquete({ nombre: pkg.nombre, descripcion: pkg.descripcion || "", precio: pkg.precio });
    setShowDialog(true);
  };

  const guardarPaquete = async () => {
    if (!formPaquete.nombre.trim() || !formPaquete.precio) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    setSavingPaquete(true);
    try {
      const data = { ...formPaquete, precio: Number(formPaquete.precio) };
      if (editandoPaquete) {
        await base44.entities.PaquetePersonalizado.update(editandoPaquete.id, data);
        toast.success("Paquete actualizado");
      } else {
        await base44.entities.PaquetePersonalizado.create(data);
        toast.success("Paquete creado");
      }
      setShowDialog(false);
      loadAll();
    } catch (e) { toast.error("Error al guardar paquete"); }
    setSavingPaquete(false);
  };

  const eliminarPaquete = async (id) => {
    if (!confirm("¿Eliminar este paquete?")) return;
    try {
      await base44.entities.PaquetePersonalizado.delete(id);
      toast.success("Paquete eliminado");
      loadAll();
    } catch (e) { toast.error("Error al eliminar"); }
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Precios estándar */}
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading">Gestión de Paquetes</h2>
        <p className="text-muted-foreground text-sm mt-1">Configure los precios de los paquetes estándar y cree paquetes personalizados</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { id: 'precio_digital', label: 'Paquete Digital', desc: 'Fotografías en formato digital' },
          { id: 'precio_fisico', label: 'Paquete Físico', desc: 'Impresiones físicas de las fotos' },
          { id: 'precio_fisico_digital', label: 'Paquete Físico + Digital', desc: 'Formato digital + impresiones físicas' },
        ].map(pkg => (
          <Card key={pkg.id} className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-heading">{pkg.label}</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">{pkg.desc}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor={pkg.id}>Precio (COP)</Label>
                <Input id={pkg.id} type="number" min="0" step="1000"
                  value={precios[pkg.id]}
                  onChange={e => setPrecios({ ...precios, [pkg.id]: Number(e.target.value) })} />
              </div>
              <p className="text-sm text-primary font-semibold mt-2">{formatCurrency(precios[pkg.id])}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={guardarPrecios} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
          {saving ? <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div>Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar Precios</>}
        </Button>
      </div>

      {/* Paquetes personalizados */}
      <div className="border-t border-border pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-foreground font-heading">Paquetes Personalizados</h3>
            <p className="text-muted-foreground text-sm mt-1">Cree paquetes adicionales con nombre y precio personalizados</p>
          </div>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Paquete
          </Button>
        </div>

        {paquetes.length === 0 ? (
          <Card className="border-dashed border-2 border-muted">
            <CardContent className="p-10 text-center">
              <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">No hay paquetes personalizados creados</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paquetes.map(pkg => (
              <Card key={pkg.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => eliminarPaquete(pkg.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-bold text-foreground font-heading">{pkg.nombre}</p>
                  {pkg.descripcion && <p className="text-xs text-muted-foreground mt-1 mb-2">{pkg.descripcion}</p>}
                  <p className="text-lg font-bold text-primary font-heading">{formatCurrency(pkg.precio)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog paquete personalizado */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editandoPaquete ? "Editar Paquete" : "Nuevo Paquete Personalizado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre del paquete *</Label>
              <Input placeholder="Ej: Paquete Premium" value={formPaquete.nombre} onChange={e => setFormPaquete({ ...formPaquete, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input placeholder="Ej: Fotos digitales + impresiones premium" value={formPaquete.descripcion} onChange={e => setFormPaquete({ ...formPaquete, descripcion: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Precio (COP) *</Label>
              <Input type="number" min="0" step="1000" placeholder="Ej: 150000" value={formPaquete.precio} onChange={e => setFormPaquete({ ...formPaquete, precio: e.target.value })} />
              {formPaquete.precio && <p className="text-sm text-primary font-semibold">{formatCurrency(Number(formPaquete.precio))}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={guardarPaquete} disabled={savingPaquete}>
                {savingPaquete ? "Guardando..." : editandoPaquete ? "Actualizar" : "Crear Paquete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}