import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buttonVariants } from '@/shared/ui/button';
import { useSesion } from '@/features/acceso/contexto-sesion';
import { consultarCuentas, ErrorSesion, mensajeSesion, operarCuenta, type AccionDeCuenta } from '@/features/acceso/cliente-sesion';

const mensajes = {
  suspender: 'Cuenta suspendida y sesiones revocadas.',
  reactivar: 'Cuenta reactivada.',
  'revocar-sesiones': 'Sesiones revocadas.',
};

function mensajeError(error: unknown): string {
  if (error instanceof ErrorSesion) {
    switch (error.estado) {
      case 403: return 'Tu cuenta no puede gestionar cuentas internas.';
      case 404: return 'La cuenta interna ya no está disponible. Actualiza la lista.';
      case 409: return 'Debe quedar al menos un administrador activo.';
      case 422: return 'La acción de cuenta no es válida.';
    }
  }
  return mensajeSesion(error);
}

export default function GestionCuentasInternas({ actorId }: { actorId: number }) {
  const [pagina, establecerPagina] = useState(1);
  const [aviso, establecerAviso] = useState('');
  const cliente = useQueryClient();
  const { comprobar } = useSesion();
  const clave = ['cuentas-internas', actorId];
  const cuentas = useQuery({
    queryKey: [...clave, pagina],
    queryFn: ({ signal }) => consultarCuentas(pagina, signal),
    retry: false,
  });
  const cambio = useMutation({
    mutationFn: ({ id, accion }: { id: number; accion: AccionDeCuenta }) => operarCuenta(id, accion),
    onSuccess: async (_, { id, accion }) => {
      establecerAviso(mensajes[accion]);
      if (id === actorId && accion !== 'reactivar') comprobar();
      await cliente.invalidateQueries({ queryKey: clave });
    },
  });

  const ejecutar = (id: number, nombre: string, accion: AccionDeCuenta) => {
    const pregunta = accion === 'suspender'
      ? `¿Suspender la cuenta de ${nombre} y cerrar todas sus sesiones?`
      : `¿Cerrar todas las sesiones de ${nombre}?`;
    if (accion !== 'reactivar' && !window.confirm(pregunta)) return;
    establecerAviso('');
    cambio.mutate({ id, accion });
  };

  return (
    <section aria-label="Gestión de cuentas internas" className="space-y-4">
      {cuentas.isPending && <p role="status">Cargando cuentas…</p>}
      {cuentas.isError && (
        <div className="space-y-2">
          <p role="alert">{mensajeError(cuentas.error)}</p>
          <button type="button" className={buttonVariants({ variant: 'outline' })}
            onClick={() => void cuentas.refetch()}>Actualizar lista</button>
        </div>
      )}
      {cambio.isError && <p role="alert">{mensajeError(cambio.error)}</p>}
      <p role="status">{aviso || (cambio.isPending ? 'Aplicando el cambio…' : '')}</p>
      {!cuentas.isError && cuentas.data && (
        <>
          {cuentas.data.data.length === 0 && <p>No hay cuentas en esta página.</p>}
          <ul className="space-y-3">
            {cuentas.data.data.map(cuenta => (
              <li key={cuenta.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-medium">{cuenta.nombre}{cuenta.id === actorId && ' (tu cuenta)'}</p>
                  <p className="break-all text-sm text-muted-foreground">{cuenta.correo}</p>
                  <p className="text-sm">{cuenta.activa ? 'Activa' : 'Suspendida'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonVariants({ variant: cuenta.activa ? 'destructive' : 'default' })}
                    disabled={cambio.isPending}
                    onClick={() => ejecutar(cuenta.id, cuenta.nombre, cuenta.activa ? 'suspender' : 'reactivar')}>
                    {cuenta.activa ? 'Suspender' : 'Reactivar'}
                  </button>
                  {cuenta.activa && (
                    <button type="button" className={buttonVariants({ variant: 'outline' })} disabled={cambio.isPending}
                      onClick={() => ejecutar(cuenta.id, cuenta.nombre, 'revocar-sesiones')}>
                      Revocar sesiones
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {(pagina > 1 || cuentas.data.hayMas) && (
            <nav aria-label="Páginas de cuentas" className="flex items-center gap-3">
              <button type="button" className={buttonVariants({ variant: 'outline' })}
                disabled={pagina === 1 || cambio.isPending}
                onClick={() => establecerPagina(pagina - 1)}>Anterior</button>
              <span>Página {pagina}</span>
              <button type="button" className={buttonVariants({ variant: 'outline' })}
                disabled={!cuentas.data.hayMas || cambio.isPending}
                onClick={() => establecerPagina(pagina + 1)}>Siguiente</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
