import { MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/** @param {{ fecha: string, lugar?: string | null, destacarFecha?: boolean }} props */
export default function DatosEvento({ fecha, lugar, destacarFecha = false }) {
  let fechaVisible = fecha;
  try {
    fechaVisible = format(parseISO(fecha), "d 'de' MMMM, yyyy", { locale: es });
  } catch {
    // * Conserva la fecha original de los registros legados que no estén en formato ISO.
  }
  const fechaFormateada = <time dateTime={fecha}>{fechaVisible}</time>;

  return (
    <div className={destacarFecha
      ? "min-w-0 space-y-1 text-sm text-muted-foreground"
      : "flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm text-muted-foreground"}>
      {destacarFecha
        ? <h3 className="font-heading text-base font-semibold leading-snug text-foreground sm:text-lg">{fechaFormateada}</h3>
        : fechaFormateada}
      {lugar && (
        <span className="flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]">
          <MapPin aria-hidden="true" className="size-3 shrink-0" />
          <span className="min-w-0">{lugar}</span>
        </span>
      )}
    </div>
  );
}
