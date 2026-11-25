import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-heading text-3xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">Revisa la dirección o vuelve al inicio.</p>
        <Link to="/" className="panel-accion mx-auto">Volver al inicio</Link>
      </div>
    </main>
  );
}
