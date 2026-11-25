import React, { useState, useEffect } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import { Shield, Plus, Edit2, Trash2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { toast } from "sonner";

const rolLabels = { presidente: "Presidente", vicepresidente: "Vicepresidente" };

export default function GestionAdministradores() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ nombre_completo: "", username: "", password: "", rol: "presidente" });

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Administrador.list();
      setAdmins(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openCreate = () => {
    setEditando(null);
    setForm({ nombre_completo: "", username: "", password: "", rol: "presidente" });
    setShowPassword(false);
    setShowDialog(true);
  };

  const openEdit = (admin) => {
    setEditando(admin);
    setForm({ nombre_completo: admin.nombre_completo, username: admin.username, password: admin.password, rol: admin.rol });
    setShowPassword(false);
    setShowDialog(true);
  };

  const guardar = async () => {
    if (!form.nombre_completo.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error("Complete todos los campos obligatorios");
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await base44.entities.Administrador.update(editando.id, form);
        toast.success("Administrador actualizado");
      } else {
        await base44.entities.Administrador.create(form);
        toast.success("Administrador creado");
      }
      setShowDialog(false);
      loadAdmins();
    } catch (e) { toast.error("Error al guardar"); }
    setSaving(false);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este administrador?")) return;
    try {
      await base44.entities.Administrador.delete(id);
      toast.success("Administrador eliminado");
      loadAdmins();
    } catch (e) { toast.error("Error al eliminar"); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">Administradores</h2>
          <p className="text-muted-foreground text-sm mt-1">{admins.length} administrador(es) registrado(s)</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Administrador
        </Button>
      </div>

      {admins.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">No hay administradores registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map(admin => (
            <Card key={admin.id} className="border-border/50 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-sm font-bold text-accent">
                    {admin.nombre_completo?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(admin)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => eliminar(admin.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="font-bold text-foreground font-heading">{admin.nombre_completo}</p>
                <p className="text-sm text-muted-foreground">@{admin.username}</p>
                <Badge className={`mt-2 text-xs ${admin.rol === 'presidente' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                  <Shield className="w-3 h-3 mr-1" />
                  {rolLabels[admin.rol] || admin.rol}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editando ? "Editar Administrador" : "Nuevo Administrador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input placeholder="Nombre completo" value={form.nombre_completo} onChange={e => setForm({ ...form, nombre_completo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Usuario *</Label>
              <Input placeholder="Nombre de usuario" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={form.rol} onValueChange={val => setForm({ ...form, rol: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presidente">Presidente</SelectItem>
                  <SelectItem value="vicepresidente">Vicepresidente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={guardar} disabled={saving}>
                {saving ? "Guardando..." : editando ? "Actualizar" : "Crear Administrador"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}