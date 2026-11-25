import React from "react";

/**
 * @param {{
 *   indicadores: { label: string, value: React.ReactNode, icon: import("lucide-react").LucideIcon,
 *     tono?: "principal" | "exito" | "aviso" | "neutro" }[]
 * }} props
 */
export default function IndicadoresPanel({ indicadores }) {
  return (
    <dl className="panel-indicadores">
      {indicadores.map(({ label, value, icon: Icono, tono = "principal" }) => (
        <div key={label} className="panel-indicador">
          <dt>
            <span className="panel-indicador__icono" data-tono={tono}>
              <Icono aria-hidden="true" className="size-[18px]" />
            </span>
            <span className="mt-3 block">{label}</span>
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
