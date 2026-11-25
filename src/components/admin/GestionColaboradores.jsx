import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, UserPlus, UserCheck, UserX, Mail, Phone, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// Iniciales: primera letra del primer nombre + primera letra del primer apellido
function getInitials(nombre) {
  if (!nombre) return "C";
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function GestionColaboradores({ onUpdate }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  const emptyForm = {
    nombre_completo: "", telefono_principal: "", telefono_secundario: "",
    email: "", direccion: "", username: "", password: "", activo: true
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadColaboradores(); }, []);

  const loadColaboradores = async () => {
    try {
      const data = await base44.entities.Colaborador.list('-created_date');
      setColaboradores(data);
    } catch (error) {
      console.error("Error cargando colaboradores:", error);
      toast.error("Error al cargar colaboradores");
    }
    setLoading(false);
  };

  const resetForm = () => { setForm(emptyForm); setEditMode(false); setEditId(null); };

  const openCreate = () => { resetForm(); setShowDialog(true); };

  const openEdit = (col) => {
    setForm({
      nombre_completo: col.nombre_completo || "",
      telefono_principal: col.telefono_principal || "",
      telefono_secundario: col.telefono_secundario || "",
      email: col.email || "",
      direccion: col.direccion || "",
      username: col.username || "",
      password: col.password || "",
      activo: col.activo !== false
    });
    setEditMode(true);
    setEditId(col.id);
    setShowDialog(true);
  };

  const guardarColaborador = async () => {
    if (!form.nombre_completo.trim()) { toast.error("El nombre completo es obligatorio"); return; }
    if (!form.telefono_principal.trim()) { toast.error("El teléfono principal es obligatorio"); return; }
    if (!form.username.trim()) { toast.error("El usuario es obligatorio"); return; }
    if (!form.password.trim() && !editMode) { toast.error("La contraseña es obligatoria"); return; }

    if (!editMode) {
      const existing = await base44.entities.Colaborador.filter({ username: form.username.trim() });
      if (existing.length > 0) { toast.error("Ya existe un colaborador con ese nombre de usuario"); return; }
    }

    setSaving(true);
    try {
      const dataToSave = { ...form };
      if (editMode && !dataToSave.password.trim()) {
        const existing = colaboradores.find(c => c.id === editId);
        dataToSave.password = existing?.password || dataToSave.password;
      }
      if (editMode) {
        await base44.entities.Colaborador.update(editId, dataToSave);
        toast.success("Colaborador actualizado exitosamente");
      } else {
        await base44.entities.Colaborador.create(dataToSave);
        toast.success("Colaborador creado exitosamente");
      }
      setShowDialog(false);
      resetForm();
      loadColaboradores();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Error al guardar colaborador: " + (error?.message || "intente de nuevo"));
    }
    setSaving(false);
  };

  const toggleActivo = async (col) => {
    try {
      await base44.entities.Colaborador.update(col.id, { activo: col.activo === false ? true : false });
      toast.success(col.activo !== false ? "Colaborador desactivado" : "Colaborador activado");
      loadColaboradores();
      if (onUpdate) onUpdate();
    } catch (error) { toast.error("Error al cambiar estado"); }
  };

  const eliminarColaborador = async (col) => {
    if (!confirm(`¿Eliminar definitivamente a ${col.nombre_completo}?`)) return;
    try {
      await base44.entities.Colaborador.delete(col.id);
      toast.success("Colaborador eliminado");
      loadColaboradores();
      if (onUpdate) onUpdate();
    } catch (error) { toast.error("Error al eliminar colaborador"); }
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
          <h2 className="text-2xl font-bold text-foreground font-heading">Gestión de Colaboradores</h2>
          <p className="text-muted-foreground text-sm mt-1">{colaboradores.length} colaborador(es) registrado(s)</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
          <UserPlus className="w-4 h-4 mr-2" /> Crear Colaborador
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {editMode ? "Editar Colaborador" : "Crear Nuevo Colaborador"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nombre completo *</Label>
                <Input value={form.nombre_completo} onChange={e => setForm({ ...form, nombre_completo: e.target.value })} placeholder="Ej. Juan Pérez" />
              </div>
              <div className="space-y-2">
                <Label>Teléfono principal *</Label>
                <Input value={form.telefono_principal} onChange={e => setForm({ ...form, telefono_principal: e.target.value })} placeholder="Ej. 3001234567" />
              </div>
              <div className="space-y-2">
                <Label>Teléfono secundario</Label>
                <Input value={form.telefono_secundario} onChange={e => setForm({ ...form, telefono_secundario: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Ej. Calle 123 #45-67" />
              </div>
              <div className="space-y-2">
                <Label>Usuario * <span className="text-xs text-muted-foreground">(para iniciar sesión)</span></Label>
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Ej. juan.perez" />
              </div>
              <div className="space-y-2">
                <Label>Contraseña {!editMode && '*'}</Label>
                <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={editMode ? "Dejar vacío para mantener" : "Contraseña de acceso"} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={guardarColaborador} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div> Guardando...</>
                  : <>{editMode ? 'Actualizar' : 'Crear'} Colaborador</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {colaboradores.length === 0 ? (
          <Card className="col-span-full border-dashed border-2 border-muted">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Sin colaboradores</h3>
              <p className="text-muted-foreground">Cree su primer colaborador para comenzar</p>
            </CardContent>
          </Card>
        ) : (
          colaboradores.map(col => (
            <Card key={col.id} className="border-border/50 hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                {/* Cabecera: avatar + nombre + badge en la misma fila */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{getInitials(col.nombre_completo)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{col.nombre_completo}</p>
                      <Badge className={
                        col.activo !== false
                          ? 'bg-green-100 text-green-700 border-green-200 shrink-0'
                          : 'bg-accent/10 text-accent border-accent/20 shrink-0'
                      }>
                        {col.activo !== false
                          ? <><UserCheck className="w-3 h-3 mr-1" />Activo</>
                          : <><UserX className="w-3 h-3 mr-1" />Inactivo</>}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">@{col.username}</p>
                    {col.telefono_principal && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="w-3 h-3" />{col.telefono_principal}
                      </div>
                    )}
                    {col.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="w-3 h-3" />{col.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => openEdit(col)} variant="outline" size="sm" className="flex-1">
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button onClick={() => toggleActivo(col)} variant="outline" size="sm"
                    className={col.activo !== false ? 'text-accent hover:bg-accent/5' : 'text-green-600 hover:bg-green-50'}>
                    {col.activo !== false ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button onClick={() => eliminarColaborador(col)} variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}