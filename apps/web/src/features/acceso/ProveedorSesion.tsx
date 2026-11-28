import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/ui/use-toast';
import { consultarSesion, ErrorSesion, iniciarSesion, mensajeSesion, terminarSesion, type Credenciales } from './cliente-sesion';
import CambioInicial from './cambio-inicial';
import { ContextoSesion, type EstadoSesion } from './contexto-sesion';

export default function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, establecerEstado] = useState<EstadoSesion>({ tipo: 'comprobando' });
  const avisoSalida = useRef<ReturnType<typeof toast>>();
  const consulta = useRef<AbortController>();
  const operacion = useRef<AbortController>();
  const clienteConsultas = useQueryClient();
  const { pathname } = useLocation();

  const comprobar = useCallback(async () => {
    if (operacion.current || consulta.current) return;
    const control = new AbortController();
    consulta.current = control;
    try {
      const identidad = await consultarSesion(control.signal);
      if (!control.signal.aborted) establecerEstado({ tipo: 'autenticado', identidad });
    } catch (error) {
      if (control.signal.aborted) return;
      if (error instanceof ErrorSesion && [401, 403].includes(error.estado)) {
        clienteConsultas.clear();
        establecerEstado(anterior => ({
          tipo: 'anonimo',
          aviso: error.estado === 403 || anterior.tipo === 'autenticado'
            ? mensajeSesion(error)
            : anterior.tipo === 'anonimo' ? anterior.aviso : undefined,
        }));
      } else {
        establecerEstado(anterior => anterior.tipo === 'anonimo' || anterior.tipo === 'comprobando'
          ? { tipo: 'anonimo', aviso: mensajeSesion(error) }
          : { tipo: 'error', mensaje: mensajeSesion(error) });
      }
    } finally {
      if (consulta.current === control) consulta.current = undefined;
    }
  }, [clienteConsultas]);

  useEffect(() => {
    void comprobar();
  }, [comprobar, pathname]);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void comprobar();
    };
    window.addEventListener('focus', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    const intervalo = window.setInterval(alVolver, 30000);

    return () => {
      window.removeEventListener('focus', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
      window.clearInterval(intervalo);
      consulta.current?.abort();
      operacion.current?.abort();
      consulta.current = undefined;
      operacion.current = undefined;
    };
  }, [comprobar]);

  const ejecutar = async (accion: (signal: AbortSignal) => Promise<EstadoSesion>) => {
    if (operacion.current) return;
    consulta.current?.abort();
    const control = new AbortController();
    operacion.current = control;
    try {
      const siguiente = await accion(control.signal);
      if (!control.signal.aborted) {
        clienteConsultas.clear();
        if (siguiente.tipo === 'autenticado') avisoSalida.current?.dismiss();
        establecerEstado(siguiente);
      }
    } finally {
      if (operacion.current === control) operacion.current = undefined;
    }
  };

  const iniciar = (credenciales: Credenciales) => ejecutar(async signal => ({
    tipo: 'autenticado',
    identidad: await iniciarSesion(credenciales, signal),
  }));

  const cerrar = () => ejecutar(async signal => {
    establecerEstado({ tipo: 'comprobando' });
    try {
      await terminarSesion(signal);
      avisoSalida.current?.dismiss();
      avisoSalida.current = toast({ title: 'Cerraste sesión', duration: 4000 });
      return { tipo: 'anonimo' };
    } catch (error) {
      return { tipo: 'error', mensaje: `No se pudo confirmar el cierre de sesión. ${mensajeSesion(error)}` };
    }
  });

  return <ContextoSesion.Provider value={{ estado, iniciar, cerrar, comprobar }}>
    {estado.tipo === 'autenticado' && estado.identidad.cambio_clave_pendiente
      ? <CambioInicial key={estado.identidad.id} alTerminar={() => { clienteConsultas.clear(); establecerEstado({ tipo: 'anonimo', aviso: 'Contraseña actualizada. Ingresa con tu nueva contraseña.' }); }} alCerrar={() => void cerrar()} />
      : children}
  </ContextoSesion.Provider>;
}
