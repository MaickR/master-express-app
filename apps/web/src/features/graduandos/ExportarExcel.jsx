import React, { useState, useEffect } from "react";
import { base44 } from "@/integrations/base44/base44Client";
import XLSXStyle from "xlsx-js-style";
import { FileSpreadsheet, Download, Filter, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import { toast } from "sonner";

const paqueteLabels   = { digital: "Digital", fisico: "Físico", fisico_digital: "Físico + Digital" };
const medioPagoLabels = { efectivo: "Efectivo", transferencia: "Transferencia", nequi: "Nequi", daviplata: "Daviplata", tarjeta: "Tarjeta", otro: "Otro" };

const COLS = [
  { key: "nombre_completo",    label: "Nombre Completo",     width: 30, align: "left"   },
  { key: "telefono",           label: "Número de Teléfono",  width: 20, align: "center" },
  { key: "direccion",          label: "Dirección",           width: 28, align: "left"   },
  { key: "barrio",             label: "Barrio",              width: 18, align: "left"   },
  { key: "ciudad",             label: "Ciudad",              width: 18, align: "left"   },
  { key: "correo",             label: "Correo Electrónico",  width: 30, align: "left"   },
  { key: "colaborador_nombre", label: "Registrado Por",      width: 22, align: "left"   },
  { key: "paquete_label",      label: "Paquete Adquirido",   width: 20, align: "center" },
  { key: "valor_total",        label: "Valor Total",         width: 16, align: "right", isMoney: true },
  { key: "abono",              label: "Abono",               width: 16, align: "right", isMoney: true },
  { key: "saldo",              label: "Saldo Pendiente",     width: 16, align: "right", isMoney: true },
  { key: "medio_pago_label",   label: "Medio de Pago",       width: 18, align: "center" },
  { key: "estado_pago_label",  label: "Estado de Pago",      width: 16, align: "center" },
];

const NUM_COLS = COLS.length;

// ── Estilos reutilizables ─────────────────────────────────────────────────────
const BORDER = {
  top:    { style: "thin", color: { rgb: "D0D7E0" } },
  bottom: { style: "thin", color: { rgb: "D0D7E0" } },
  left:   { style: "thin", color: { rgb: "D0D7E0" } },
  right:  { style: "thin", color: { rgb: "D0D7E0" } },
};

const styleTitle = {
  font:      { bold: true, sz: 16, color: { rgb: "1E3A5F" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill:      { fgColor: { rgb: "FFFFFF" } },
};

const styleSubtitle = {
  font:      { bold: false, sz: 11, color: { rgb: "4A5568" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill:      { fgColor: { rgb: "FFFFFF" } },
};

const styleMeta = {
  font:      { sz: 10, color: { rgb: "718096" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill:      { fgColor: { rgb: "FFFFFF" } },
};

const styleColHeader = (align) => ({
  font:      { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
  fill:      { fgColor: { rgb: "1E4080" } },
  alignment: { horizontal: align, vertical: "center", wrapText: true },
  border:    BORDER,
});

const styleData = (align) => ({
  font:      { sz: 10, color: { rgb: "1A202C" } },
  fill:      { fgColor: { rgb: "FFFFFF" } },
  alignment: { horizontal: align, vertical: "center" },
  border:    BORDER,
});

const styleDataAlt = (align) => ({
  font:      { sz: 10, color: { rgb: "1A202C" } },
  fill:      { fgColor: { rgb: "F7FAFC" } },
  alignment: { horizontal: align, vertical: "center" },
  border:    BORDER,
});

const styleMoney = (align, isAlt) => ({
  font:      { sz: 10, color: { rgb: "1A202C" } },
  fill:      { fgColor: { rgb: isAlt ? "F7FAFC" : "FFFFFF" } },
  alignment: { horizontal: align, vertical: "center" },
  border:    BORDER,
  numFmt:    '"$"#,##0',
});

const styleCompleto = {
  font:      { bold: true, sz: 10, color: { rgb: "276749" } },
  fill:      { fgColor: { rgb: "C6F6D5" } },
  alignment: { horizontal: "center", vertical: "center" },
  border:    BORDER,
};

const stylePendiente = {
  font:      { bold: true, sz: 10, color: { rgb: "7B5E00" } },
  fill:      { fgColor: { rgb: "FEFCBF" } },
  alignment: { horizontal: "center", vertical: "center" },
  border:    BORDER,
};

function makeCell(value, style) {
  return { v: value, s: style };
}

function encodeCol(n) {
  let s = "";
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

export default function ExportarExcel() {
  const [loading,       setLoading]       = useState(true);
  const [exporting,     setExporting]     = useState(false);
  const [graduandos,    setGraduandos]    = useState([]);
  const [eventos,       setEventos]       = useState([]);
  const [ceremonias,    setCeremonias]    = useState([]);
  const [colaboradores, setColaboradores] = useState([]);

  const [filtroEvento,      setFiltroEvento]      = useState("todos");
  const [filtroCeremonia,   setFiltroCeremonia]   = useState("todos");
  const [filtroCarrera,     setFiltroCarrera]     = useState("todos");
  const [filtroColaborador, setFiltroColaborador] = useState("todos");
  const [filtroPago,        setFiltroPago]        = useState("todos");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [grads, evs, cers, cols] = await Promise.all([
        base44.entities.Graduando.list(),
        base44.entities.Evento.list(),
        base44.entities.Ceremonia.list(),
        base44.entities.Colaborador.list(),
      ]);
      setGraduandos(grads.filter(g => !g.eliminado));
      setEventos(evs);
      setCeremonias(cers);
      setColaboradores(cols);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const eventoMap      = Object.fromEntries(eventos.map(e => [e.id, e]));
  const ceremoniaMap   = Object.fromEntries(ceremonias.map(c => [c.id, c]));
  const colaboradorMap = Object.fromEntries(colaboradores.map(c => [c.id, c]));
  const carreras       = [...new Set(graduandos.map(g => g.programa_academico).filter(Boolean))].sort();

  const filtrados = graduandos.filter(g => {
    if (filtroEvento      !== "todos" && g.evento_id          !== filtroEvento)      return false;
    if (filtroCeremonia   !== "todos" && g.ceremonia_id       !== filtroCeremonia)   return false;
    if (filtroCarrera     !== "todos" && g.programa_academico !== filtroCarrera)     return false;
    if (filtroColaborador !== "todos" && g.colaborador_id     !== filtroColaborador) return false;
    if (filtroPago        !== "todos" && g.estado_pago        !== filtroPago)        return false;
    return true;
  });

  const limpiarFiltros = () => {
    setFiltroEvento("todos"); setFiltroCeremonia("todos");
    setFiltroCarrera("todos"); setFiltroColaborador("todos"); setFiltroPago("todos");
  };

  const exportar = () => {
    if (filtrados.length === 0) { toast.error("No hay registros para exportar"); return; }
    setExporting(true);

    try {
      const wb = XLSXStyle.utils.book_new();
      const ws = {};

      const eventoLabel    = filtroEvento    === "todos" ? "Todos los eventos"    : (eventoMap[filtroEvento]?.nombre_institucion    || "");
      const ceremoniaLabel = filtroCeremonia === "todos" ? "Todas las ceremonias" : (ceremoniaMap[filtroCeremonia]?.nombre           || "");
      const fechaExport    = new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
      const lastCol        = encodeCol(NUM_COLS - 1); // ej. "M"

      // ── Filas de encabezado (0-based) ─────────────────────────────────────
      // Fila 0: Título principal
      ws["A1"] = makeCell("MASTER EXPRESS EVENTOS", styleTitle);
      // Fila 1: Subtítulo
      ws["A2"] = makeCell("Reporte de Graduandos", styleSubtitle);
      // Fila 2: Evento
      ws["A3"] = makeCell(`Evento: ${eventoLabel}`, styleMeta);
      // Fila 3: Ceremonia
      ws["A4"] = makeCell(`Ceremonia: ${ceremoniaLabel}`, styleMeta);
      // Fila 4: Fecha
      ws["A5"] = makeCell(`Fecha de exportación: ${fechaExport}`, styleMeta);
      // Fila 5: Total
      ws["A6"] = makeCell(`Total de registros exportados: ${filtrados.length}`, styleMeta);
      // Fila 6: vacía separadora (fila 7 en Excel)

      // ── Encabezados de columna en fila 8 (índice 7) ───────────────────────
      const headerRowIdx = 7; // 0-based
      COLS.forEach((col, ci) => {
        const addr = `${encodeCol(ci)}${headerRowIdx + 1}`;
        ws[addr] = makeCell(col.label, styleColHeader(col.align));
      });

      // ── Filas de datos desde fila 9 ───────────────────────────────────────
      filtrados.forEach((g, ri) => {
        const isAlt = ri % 2 === 1;
        const rowNum = headerRowIdx + 2 + ri; // Excel row number (1-based)

        COLS.forEach((col, ci) => {
          const addr = `${encodeCol(ci)}${rowNum}`;
          let value;
          switch (col.key) {
            case "colaborador_nombre": value = colaboradorMap[g.colaborador_id]?.nombre_completo || ""; break;
            case "paquete_label":      value = paqueteLabels[g.paquete] || g.paquete || ""; break;
            case "medio_pago_label":   value = medioPagoLabels[g.medio_pago] || g.medio_pago || ""; break;
            case "estado_pago_label":  value = g.estado_pago === "completo" ? "Completo" : "Pendiente"; break;
            case "valor_total":        value = g.valor_total || 0; break;
            case "abono":              value = g.abono || 0; break;
            case "saldo":              value = g.saldo || 0; break;
            default:                   value = g[col.key] ?? "";
          }

          let cellStyle;
          if (col.key === "estado_pago_label") {
            cellStyle = value === "Completo" ? styleCompleto : stylePendiente;
          } else if (col.isMoney) {
            cellStyle = styleMoney(col.align, isAlt);
          } else {
            cellStyle = isAlt ? styleDataAlt(col.align) : styleData(col.align);
          }

          ws[addr] = makeCell(value, cellStyle);
        });
      });

      // ── Rango ─────────────────────────────────────────────────────────────
      const lastDataRow = headerRowIdx + 1 + filtrados.length;
      ws["!ref"] = `A1:${lastCol}${lastDataRow}`;

      // ── Celdas combinadas para el encabezado ──────────────────────────────
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: NUM_COLS - 1 } }, // Título
        { s: { r: 1, c: 0 }, e: { r: 1, c: NUM_COLS - 1 } }, // Subtítulo
        { s: { r: 2, c: 0 }, e: { r: 2, c: NUM_COLS - 1 } }, // Evento
        { s: { r: 3, c: 0 }, e: { r: 3, c: NUM_COLS - 1 } }, // Ceremonia
        { s: { r: 4, c: 0 }, e: { r: 4, c: NUM_COLS - 1 } }, // Fecha
        { s: { r: 5, c: 0 }, e: { r: 5, c: NUM_COLS - 1 } }, // Total
        { s: { r: 6, c: 0 }, e: { r: 6, c: NUM_COLS - 1 } }, // Separador vacío
      ];

      // ── Anchos de columna ─────────────────────────────────────────────────
      ws["!cols"] = COLS.map(c => ({ wch: c.width }));

      // ── Alturas de fila para el encabezado ───────────────────────────────
      ws["!rows"] = [
        { hpt: 28 }, // Título
        { hpt: 20 }, // Subtítulo
        { hpt: 16 }, // Evento
        { hpt: 16 }, // Ceremonia
        { hpt: 16 }, // Fecha
        { hpt: 16 }, // Total
        { hpt: 8  }, // Separador
        { hpt: 28 }, // Encabezados columna
      ];

      // ── Congelar fila de encabezados de columna ───────────────────────────
      ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };

      // ── Filtros automáticos en la fila de encabezados ─────────────────────
      ws["!autofilter"] = { ref: `A${headerRowIdx + 1}:${lastCol}${headerRowIdx + 1}` };

      XLSXStyle.utils.book_append_sheet(wb, ws, "Graduandos");
      XLSXStyle.writeFile(wb, `graduandos_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`✓ Exportados ${filtrados.length} registros en Excel`);
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el archivo Excel");
    }

    setExporting(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-primary" /> Exportar a Excel
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Filtre los registros y exporte un archivo Excel (.xlsx) listo para usar.
        </p>
      </div>

      {/* Filtros */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" /> Filtros de Exportación
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Evento</Label>
            <Select value={filtroEvento} onValueChange={v => { setFiltroEvento(v); setFiltroCeremonia("todos"); }}>
              <SelectTrigger><SelectValue placeholder="Todos los eventos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los eventos</SelectItem>
                {eventos.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_institucion}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ceremonia</Label>
            <Select value={filtroCeremonia} onValueChange={setFiltroCeremonia}>
              <SelectTrigger><SelectValue placeholder="Todas las ceremonias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las ceremonias</SelectItem>
                {(filtroEvento === "todos" ? ceremonias : ceremonias.filter(c => c.evento_id === filtroEvento)).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Carrera / Programa</Label>
            <Select value={filtroCarrera} onValueChange={setFiltroCarrera}>
              <SelectTrigger><SelectValue placeholder="Todas las carreras" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las carreras</SelectItem>
                {carreras.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Colaborador</Label>
            <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
              <SelectTrigger><SelectValue placeholder="Todos los colaboradores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los colaboradores</SelectItem>
                {colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre_completo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Estado de Pago</Label>
            <Select value={filtroPago} onValueChange={setFiltroPago}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="completo">Pago completo</SelectItem>
                <SelectItem value="pendiente">Pago pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={limpiarFiltros}>
              <X className="w-4 h-4 mr-2" /> Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contador + botón exportar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
        <div className="flex items-center gap-3">
          <Check className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-foreground">
              <span className="text-primary text-lg font-bold">{filtrados.length}</span> registros seleccionados
            </p>
            <p className="text-xs text-muted-foreground">Se exportarán con los filtros actuales</p>
          </div>
        </div>

        <Button
          onClick={exportar}
          disabled={exporting || filtrados.length === 0}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-6"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Generando..." : "Exportar a Excel"}
        </Button>
      </div>
    </div>
  );
}