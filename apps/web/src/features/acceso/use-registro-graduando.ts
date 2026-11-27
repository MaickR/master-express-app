import { useEffect, useRef, useState } from 'react';
import { ErrorSesion, solicitar } from './cliente-sesion';
import type { DatosRegistro } from './vistas-registro';

export const camposDelServidor = {
  email: 'correo', nombres: 'nombres', apellidos: 'apellidos', telefono: 'telefono',
  tipo_documento: 'tipoDocumento', numero_documento: 'numeroDocumento',
  password: 'contrasena', password_confirmation: 'confirmacion',
} as const;

export const normalizarCorreo = (correo = '') => correo.trim().toLowerCase();

export function datosDeCuenta(datos: DatosRegistro) {
  const tipo = datos.tipoDocumento === 'Cédula de ciudadanía' ? 'cedula_ciudadania' : 'tarjeta_identidad';
  return {
    email: normalizarCorreo(datos.correo),
    nombres: datos.nombres?.trim(),
    apellidos: datos.apellidos?.trim(),
    telefono: datos.telefono?.trim(),
    password: datos.contrasena,
    password_confirmation: datos.confirmacion,
    ...(datos.tipoDocumento ? { tipo_documento: tipo, numero_documento: datos.numeroDocumento } : {}),
  };
}

type Operacion = 'codigo' | 'confirmacion' | 'cuenta';
type Esperas = Partial<Record<Operacion, number>>;

export function useRegistroGraduando() {
  const activa = useRef<AbortController | null>(null);
  const [ocupada, cambiarOcupada] = useState<Operacion | null>(null);
  const [esperas, cambiarEsperas] = useState<Esperas>({});
  const [reenvio, cambiarReenvio] = useState<{ correo: string; hasta: number }>();
  const [solicitado, cambiarSolicitado] = useState('');

  useEffect(() => () => activa.current?.abort(), []);
  useEffect(() => {
    const vencimientos = [...Object.values(esperas), ...(reenvio ? [reenvio.hasta] : [])];
    if (!vencimientos.length) return;
    const id = window.setTimeout(() => {
      const ahora = Date.now();
      cambiarEsperas(actual => Object.fromEntries(Object.entries(actual).filter(([, hasta]) => hasta > ahora)));
      cambiarReenvio(actual => actual && actual.hasta > ahora ? actual : undefined);
    }, Math.max(0, Math.min(...vencimientos) - Date.now()));
    return () => window.clearTimeout(id);
  }, [esperas, reenvio]);

  function espera(operacion: Operacion, correo = '') {
    const hasta = Math.max(esperas[operacion] ?? 0,
      operacion === 'codigo' && reenvio?.correo === correo ? reenvio.hasta : 0);
    return Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
  }

  function cambiarCorreo() {
    cambiarSolicitado('');
    cambiarReenvio(undefined);
  }

  async function operar<T extends { email: string }>(operacion: Operacion, cuerpo: T): Promise<true | ErrorSesion | null> {
    if (activa.current || espera(operacion, cuerpo.email)) return null;
    const controlador = new AbortController();
    activa.current = controlador;
    cambiarOcupada(operacion);
    try {
      await solicitar('/sanctum/csrf-cookie', controlador.signal);
      await solicitar('/api/registro-graduando/' + operacion, controlador.signal, cuerpo,
        [...Object.keys(camposDelServidor), 'codigo', 'solicitud']);
      if (operacion === 'codigo') {
        cambiarSolicitado(cuerpo.email);
        cambiarReenvio({ correo: cuerpo.email, hasta: Date.now() + 60000 });
        cambiarEsperas(actual => ({ ...actual, confirmacion: 0 }));
      }
      return true;
    } catch (fallo) {
      if (controlador.signal.aborted) return null;
      const error = fallo instanceof ErrorSesion ? fallo : new ErrorSesion(0);
      if (error.estado === 429) {
        cambiarEsperas(actual => ({ ...actual, [operacion]: Date.now() + (error.espera ?? 60) * 1000 }));
      }
      return error;
    } finally {
      if (!controlador.signal.aborted) {
        activa.current = null;
        cambiarOcupada(null);
      }
    }
  }

  return { operar, ocupado: ocupada !== null, enviandoCodigo: ocupada === 'codigo', espera, solicitado, cambiarCorreo };
}
