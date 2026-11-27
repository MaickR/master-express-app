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

type Operacion = 'codigo' | 'confirmacion' | 'cuenta' | 'solicitud';
type Esperas = Partial<Record<Operacion, number>>;
type RutasRegistro = Partial<Record<Operacion | 'representacion', string>>;

const rutasGraduando: RutasRegistro = {
  codigo: '/api/registro-graduando/codigo',
  confirmacion: '/api/registro-graduando/confirmacion',
  cuenta: '/api/registro-graduando/cuenta',
};
const rutasInstitucion: RutasRegistro = {
  codigo: '/api/registro-institucion/codigo',
  confirmacion: '/api/registro-institucion/confirmacion',
  solicitud: '/api/registro-institucion/solicitud',
  representacion: '/api/registro-institucion/representacion',
};
const camposInstitucion = ['tipo', 'razon_social', 'nit', 'sede', 'representante', 'telefono', 'email', 'codigo', 'solicitud'] as const;

function useDesafioCorreo(rutas: RutasRegistro, camposExtra: readonly string[]) {
  const activa = useRef<AbortController | null>(null);
  const [ocupada, cambiarOcupada] = useState<Operacion | null>(null);
  const [esperas, cambiarEsperas] = useState<Esperas>({});
  const [reenvio, cambiarReenvio] = useState<{ correo: string; hasta: number }>();
  const [solicitado, cambiarSolicitado] = useState('');
  const [reloj, avanzarReloj] = useState(0);

  useEffect(() => () => activa.current?.abort(), []);
  useEffect(() => {
    const vencimientos = [...Object.values(esperas), ...(reenvio ? [reenvio.hasta] : [])];
    if (!vencimientos.length) return;
    const id = window.setInterval(() => {
      const ahora = Date.now();
      cambiarEsperas(actual => Object.fromEntries(Object.entries(actual).filter(([, hasta]) => hasta > ahora)));
      cambiarReenvio(actual => actual && actual.hasta > ahora ? actual : undefined);
      avanzarReloj(valor => valor + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [esperas, reenvio]);

  function espera(operacion: Operacion, correo = '') {
    void reloj;
    const hasta = Math.max(esperas[operacion] ?? 0,
      operacion === 'codigo' && reenvio?.correo === correo ? reenvio.hasta : 0);
    return Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
  }

  function cambiarCorreo() {
    cambiarSolicitado('');
    cambiarReenvio(undefined);
  }

  async function despachar(operacion: Operacion, correo: string, ruta: string | undefined, cuerpo: object) {
    if (!ruta || activa.current || espera(operacion, correo)) return null;
    const controlador = new AbortController();
    activa.current = controlador;
    cambiarOcupada(operacion);
    try {
      await solicitar('/sanctum/csrf-cookie', controlador.signal);
      await solicitar(ruta, controlador.signal, cuerpo, [...Object.keys(camposDelServidor), ...camposExtra]);
      if (operacion === 'codigo') {
        cambiarSolicitado(correo);
        cambiarReenvio({ correo, hasta: Date.now() + 60000 });
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

  async function operar<T extends { email: string }>(operacion: Operacion, cuerpo: T) {
    return despachar(operacion, cuerpo.email, rutas[operacion], cuerpo);
  }

  async function representar(cuerpo: object, correo: string) {
    return despachar('solicitud', correo, rutas.representacion, cuerpo);
  }

  return { operar, representar, ocupado: ocupada !== null, enviandoCodigo: ocupada === 'codigo', espera, solicitado, cambiarCorreo };
}

export function useRegistroGraduando() {
  return useDesafioCorreo(rutasGraduando, ['codigo', 'solicitud']);
}

export function useRegistroPublico(flujo: 'graduando' | 'institucion') {
  return useDesafioCorreo(flujo === 'institucion' ? rutasInstitucion : rutasGraduando,
    flujo === 'institucion' ? camposInstitucion : ['codigo', 'solicitud']);
}
