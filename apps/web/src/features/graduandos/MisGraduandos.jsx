import React, { useState } from "react";
import { GraduationCap, CheckCircle, AlertCircle, Image, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

const paqueteLabels = { digital: 'Paquete Digital', fisico: 'Paquete Físico', fisico_digital: 'Físico + Digital' };
const medioPagoLabels = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', tarjeta: 'Tarjeta', otro: 'Otro' };

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);

function ReportRow({ label, value, valueCls = "" }) {
  return (
    <div className="flex items-baseline gap-1 text-sm">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <span className="flex-1 border-b border-dotted border-border mx-1" style={{ minWidth: 20 }}></span>
      <span className={`font-semibold text-foreground whitespace-nowrap ${valueCls}`}>{value}</span>
    </div>
  );
}

function GraduandoCard({ g, index }) {
  const [expanded, setExpanded] = useState(false);
  const isEven = index % 2 === 0;

  return (
    <Card className={`border-border/50 hover:shadow-md transition-shadow ${isEven ? 'bg-card' : 'bg-muted/30'}`}>
      <CardContent className="p-4 lg:p-5">
        {/* Vista principal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="panel-texto-accion break-words text-xl font-bold font-heading leading-tight">
              {g.nombre_completo}
            </h4>
            <div className="mt-1 space-y-0.5">
              {g.direccion && <p className="text-sm text-muted-foreground">{g.direccion}</p>}
              {g.programa_academico && <p className="text-sm text-muted-foreground">{g.programa_academico}</p>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="panel-texto-accion min-h-11 shrink-0 gap-1 text-xs hover:bg-muted"
          >
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Ocultar</> : <><ChevronDown className="w-3.5 h-3.5" />Ver más</>}
          </Button>
        </div>

        {/* Vista expandida */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-5">

            {/* Contacto — 2 columnas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="space-y-1.5">
                {g.telefono && (
                  <div>
                    <span className="font-bold text-foreground">Número de teléfono</span>
                    <p className="text-muted-foreground">{g.telefono}</p>
                  </div>
                )}
                {g.direccion && (
                  <div>
                    <span className="font-bold text-foreground">Dirección</span>
                    <p className="text-muted-foreground">{g.direccion}</p>
                  </div>
                )}
                {g.barrio && (
                  <div>
                    <span className="font-bold text-foreground">Barrio</span>
                    <p className="text-muted-foreground">{g.barrio}</p>
                  </div>
                )}
                {g.ciudad && (
                  <div>
                    <span className="font-bold text-foreground">Ciudad</span>
                    <p className="text-muted-foreground">{g.ciudad}</p>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {g.correo && (
                  <div>
                    <span className="font-bold text-foreground">Correo electrónico</span>
                    <p className="text-muted-foreground">{g.correo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Financiero — reporte con puntos */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-2">
              <ReportRow label="Paquete adquirido" value={paqueteLabels[g.paquete] || g.paquete} />
              <ReportRow label="Valor total" value={formatCurrency(g.valor_total)} />
              <ReportRow label="Abono" value={formatCurrency(g.abono)} valueCls="text-green-600" />
              <ReportRow
                label="Saldo pendiente"
                value={formatCurrency(g.saldo)}
                valueCls={(g.saldo || 0) > 0 ? "text-amber-600" : "text-green-600"}
              />
              {g.medio_pago && <ReportRow label="Medio de pago" value={medioPagoLabels[g.medio_pago] || g.medio_pago} />}
              <div className="flex items-baseline gap-1 text-sm pt-1 border-t border-border/30">
                <span className="text-muted-foreground whitespace-nowrap">Estado de pago</span>
                <span className="flex-1 border-b border-dotted border-border mx-1" style={{ minWidth: 20 }}></span>
                <Badge className={`text-xs ${g.estado_pago === 'completo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {g.estado_pago === 'completo'
                    ? <><CheckCircle className="w-3 h-3 mr-1" />PAGO COMPLETO</>
                    : <><AlertCircle className="w-3 h-3 mr-1" />PENDIENTE</>}
                </Badge>
              </div>
            </div>

            {/* Comprobantes */}
            {(g.comprobante_urls || g.foto_urls)?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">Comprobantes</p>
                <div className="flex flex-wrap gap-1.5">
                  {(g.comprobante_urls || g.foto_urls).map((url, i) => (
                    <Button key={i} variant="outline" size="sm"
                      onClick={() => window.open(url, '_blank')}
                      className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50">
                      <Image className="w-3 h-3 mr-1" />Comp. {i + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MisGraduandos({ graduandos }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground font-heading flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-primary" />
        Mis Registros de Graduandos ({graduandos.length})
      </h3>

      {graduandos.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="p-8 text-center">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">Aún no tiene graduandos registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {graduandos.map((g, i) => <GraduandoCard key={g.id} g={g} index={i} />)}
        </div>
      )}
    </div>
  );
}
