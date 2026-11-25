import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import {
  UserPlus, ArrowLeft, Camera, Upload, X, Check,
  DollarSign, GraduationCap, AlertCircle, Package, Phone, MapPin, CreditCard
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { sendRegistroGraduandoEmail } from "@/lib/emailService";

const MEDIO_PAGO_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia bancaria",
  nequi: "Nequi",
  daviplata: "Daviplata",
  tarjeta: "Tarjeta",
  otro: "Otro"
};

export default function RegistroGraduando() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [colaboradorId, setColaboradorId] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [ceremonias, setCeremonias] = useState([]);
  const [precios, setPrecios] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [stream, setStream] = useState(null);
  const [comprobantes, setComprobantes] = useState([]);

  const [form, setForm] = useState({
    nombre_completo: "",
    telefono: "",
    correo: "",
    direccion: "",
    barrio: "",
    ciudad: "",
    programa_academico: "",
    fecha: new Date().toISOString().split('T')[0],
    evento_id: "",
    ceremonia_id: "",
    paquete: "",
    medio_pago: "",
    valor_total: 0,
    abono: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (form.evento_id) loadCeremonias(form.evento_id);
  }, [form.evento_id]);

  useEffect(() => {
    if (form.paquete && precios) {
      const precioMap = {
        digital: precios.precio_digital,
        fisico: precios.precio_fisico,
        fisico_digital: precios.precio_fisico_digital
      };
      setForm(prev => ({ ...prev, valor_total: precioMap[form.paquete] || 0 }));
    }
  }, [form.paquete, precios]);

  const loadData = async () => {
    const storedId = localStorage.getItem("colaborador_id");
    if (!storedId) { navigate('/'); return; }
    setColaboradorId(storedId);

    try {
      const [eventosData, preciosData] = await Promise.all([
        base44.entities.Evento.filter({ activo: true }),
        base44.entities.Configuracion.list()
      ]);
      setEventos(eventosData);
      setPrecios(preciosData[0] || { precio_digital: 50000, precio_fisico: 100000, precio_fisico_digital: 120000 });
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
    setLoading(false);
  };

  const loadCeremonias = async (eventoId) => {
    try {
      const data = await base44.entities.Ceremonia.filter({ evento_id: eventoId });
      setCeremonias(data);
      setForm(prev => ({ ...prev, ceremonia_id: "" }));
    } catch (error) {
      console.error("Error cargando ceremonias:", error);
    }
  };

  const activarCamara = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      setCamaraActiva(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = mediaStream; }, 100);
    } catch (error) {
      alert("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  };

  const capturarComprobante = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setComprobantes(prev => [...prev, canvas.toDataURL('image/jpeg', 0.8)]);
  };

  const detenerCamara = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setCamaraActiva(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      setComprobantes(prev => [...prev, dataUrl]);
    }
  };

  const subirComprobantes = async () => {
    const urls = [];
    for (const comp of comprobantes) {
      const blob = await (await fetch(comp)).blob();
      const file = new File([blob], `comprobante_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const result = await base44.integrations.Core.UploadFile({ file });
      urls.push(result.file_url);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!form.nombre_completo.trim()) { alert("El nombre completo es obligatorio"); return; }
    if (!form.paquete) { alert("Seleccione un paquete"); return; }
    if (!form.medio_pago) { alert("Seleccione el medio de pago"); return; }

    setSaving(true);
    try {
      const comprobanteUrls = await subirComprobantes();
      const saldo = form.valor_total - (form.abono || 0);
      const estado_pago = saldo <= 0 ? 'completo' : 'pendiente';

      const graduandoCreado = await base44.entities.Graduando.create({
        ...form,
        abono: form.abono || 0,
        comprobante_urls: comprobanteUrls,
        colaborador_id: colaboradorId,
        saldo: Math.max(0, saldo),
        estado_pago,
        eliminado: false
      });

      // Envío automático del correo de confirmación al graduando
      try {
        // Obtener nombres de evento, ceremonia y colaborador para el correo
        const eventoObj = eventos.find(e => e.id === form.evento_id);
        const ceremoniaObj = ceremonias.find(c => c.id === form.ceremonia_id);
        let colaboradorNombre = "";
        try {
          const col = await base44.entities.Colaborador.get(colaboradorId);
          colaboradorNombre = col?.nombre_completo || "";
        } catch (_) {}

        await sendRegistroGraduandoEmail(
          { ...graduandoCreado },
          {
            evento: eventoObj ? `${eventoObj.nombre_institucion}` : "",
            ceremonia: ceremoniaObj ? `${ceremoniaObj.nombre}${ceremoniaObj.hora ? ' — ' + ceremoniaObj.hora : ''}` : "",
            colaborador: colaboradorNombre,
          }
        );
      } catch (emailErr) {
        // El correo falló pero el registro fue exitoso — no bloquear al colaborador
        console.warn("No se pudo enviar el correo de confirmación:", emailErr?.message);
      }

      navigate('/ColaboradorDashboard');
    } catch (error) {
      console.error("Error guardando graduando:", error);
      alert("Error al guardar el registro: " + (error?.message || "intente de nuevo"));
    }
    setSaving(false);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
  };

  const saldo = Math.max(0, (form.valor_total || 0) - (form.abono || 0));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/ColaboradorDashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al panel
          </Link>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground font-heading tracking-tight">
            Registrar Nuevo Graduando
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete el formulario para registrar un graduando y sus comprobantes de pago
          </p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardContent className="p-6 lg:p-8 space-y-8">

            {/* ─── 1. INFORMACIÓN PERSONAL ─── */}
            <div>
              <h3 className="text-lg font-bold text-foreground font-heading mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Información Personal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nombre completo *</Label>
                  <Input placeholder="Ej. Juan Pérez García" value={form.nombre_completo}
                    onChange={e => setForm({ ...form, nombre_completo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Número de teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Ej. 3001234567" value={form.telefono}
                      onChange={e => setForm({ ...form, telefono: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Correo electrónico</Label>
                  <Input type="email" placeholder="correo@ejemplo.com" value={form.correo}
                    onChange={e => setForm({ ...form, correo: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Dirección de residencia</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Ej. Calle 123 #45-67" value={form.direccion}
                      onChange={e => setForm({ ...form, direccion: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Barrio</Label>
                  <Input placeholder="Ej. El Centro" value={form.barrio}
                    onChange={e => setForm({ ...form, barrio: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input placeholder="Ej. Bogotá" value={form.ciudad}
                    onChange={e => setForm({ ...form, ciudad: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Carrera o programa académico</Label>
                  <Input placeholder="Ej. Ingeniería de Sistemas" value={form.programa_academico}
                    onChange={e => setForm({ ...form, programa_academico: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ─── 2. INFORMACIÓN DEL EVENTO ─── */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-bold text-foreground font-heading mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Información del Evento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Evento de graduación</Label>
                  <Select value={form.evento_id} onValueChange={v => setForm({ ...form, evento_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar institución / evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventos.length === 0 && <SelectItem value="_none" disabled>No hay eventos activos</SelectItem>}
                      {eventos.map(ev => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.nombre_institucion} — {ev.tipo_institucion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.evento_id && (
                  <div className="space-y-2">
                    <Label>Ceremonia</Label>
                    <Select value={form.ceremonia_id} onValueChange={v => setForm({ ...form, ceremonia_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ceremonia" />
                      </SelectTrigger>
                      <SelectContent>
                        {ceremonias.map(cer => (
                          <SelectItem key={cer.id} value={cer.id}>
                            {cer.nombre}{cer.hora ? ` — ${cer.hora}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Fecha de registro</Label>
                  <Input type="date" value={form.fecha}
                    onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ─── 3. PAQUETE ─── */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-bold text-foreground font-heading mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Seleccionar Paquete *
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'digital', label: 'Paquete Digital', precio: precios?.precio_digital || 50000 },
                  { id: 'fisico', label: 'Paquete Físico', precio: precios?.precio_fisico || 100000 },
                  { id: 'fisico_digital', label: 'Físico + Digital', precio: precios?.precio_fisico_digital || 120000 },
                ].map(pkg => (
                  <button key={pkg.id} onClick={() => setForm({ ...form, paquete: pkg.id })}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      form.paquete === pkg.id
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                        : 'border-border hover:border-primary/30 hover:bg-secondary/10'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-foreground text-sm">{pkg.label}</p>
                      {form.paquete === pkg.id && (
                        <Badge className="bg-primary text-primary-foreground"><Check className="w-3 h-3" /></Badge>
                      )}
                    </div>
                    <p className="text-lg font-bold text-primary font-heading">{formatCurrency(pkg.precio)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ─── 4. PAGO ─── */}
            {form.paquete && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="pt-6 border-t border-border">
                <h3 className="text-lg font-bold text-foreground font-heading mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Información de Pago
                </h3>

                {/* Resumen de pago visual */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-secondary/10 border border-border rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Valor Total</p>
                    <p className="text-xl font-bold text-foreground font-heading">{formatCurrency(form.valor_total)}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Abono</p>
                    <Input
                      type="number" min="0" placeholder="0"
                      value={form.abono || ''}
                      onChange={e => setForm({ ...form, abono: Number(e.target.value) })}
                      className="text-center text-lg font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                  <div className={`rounded-xl p-4 text-center border-2 ${saldo <= 0 ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                    <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Saldo Pendiente</p>
                    <p className={`text-xl font-bold font-heading ${saldo <= 0 ? 'text-green-700' : 'text-amber-700'}`}>
                      {formatCurrency(saldo)}
                    </p>
                    <Badge className={`mt-1 text-xs ${saldo <= 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {saldo <= 0 ? <><Check className="w-3 h-3 mr-1" />COMPLETO</> : <><AlertCircle className="w-3 h-3 mr-1" />PENDIENTE</>}
                    </Badge>
                  </div>
                </div>

                {/* Medio de pago */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Medio de pago *
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(MEDIO_PAGO_LABELS).map(([key, label]) => (
                      <button key={key} onClick={() => setForm({ ...form, medio_pago: key })}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          form.medio_pago === key
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                        }`}>
                        {form.medio_pago === key && <Check className="w-3 h-3 inline mr-1" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── 5. COMPROBANTES ─── */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-bold text-foreground font-heading mb-2 flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Comprobantes de Pago
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Capture o suba imágenes de los comprobantes de pago</p>

              {!camaraActiva ? (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={activarCamara} variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
                    <Camera className="w-4 h-4 mr-2" /> Usar Cámara
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <Upload className="w-4 h-4 mr-2" /> Subir Archivos
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-xl overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline className="w-full max-h-80 object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={capturarComprobante} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Camera className="w-4 h-4 mr-2" /> Capturar
                    </Button>
                    <Button onClick={detenerCamara} variant="outline">
                      <X className="w-4 h-4 mr-2" /> Detener
                    </Button>
                  </div>
                </div>
              )}

              {comprobantes.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-foreground mb-2">{comprobantes.length} comprobante(s)</p>
                  <div className="flex flex-wrap gap-3">
                    {comprobantes.map((comp, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                        <img src={comp} alt={`Comprobante ${idx + 1}`} className="w-full h-full object-cover" />
                        <button onClick={() => setComprobantes(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-6 border-t border-border flex justify-end gap-3">
              <Link to="/ColaboradorDashboard">
                <Button variant="outline">Cancelar</Button>
              </Link>
              <Button onClick={handleSubmit} disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg font-medium">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div> Guardando...</>
                ) : (
                  <><UserPlus className="w-5 h-5 mr-2" /> Registrar Graduando</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}