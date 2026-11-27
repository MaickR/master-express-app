import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Label } from '@/shared/ui/label';
import AvisoAcceso, { tonoFalloAcceso, type TonoAcceso } from './aviso-acceso';
import Button from './BotonAcceso';
import CampoContrasena from './campo-contrasena';
import { ErrorSesion, mensajeSesion, solicitar } from './cliente-sesion';
import { MarcoAcceso } from './Home';

const Etiqueta = Label as ComponentType<ComponentProps<'label'>>;

const RUTA = '/activar-institucion';
const ENLACE_NO_DISPONIBLE = 'El enlace no está disponible. Puede haber vencido, haberse usado, o la solicitud todavía no está aprobada.';

function leerEnlace() {
  if (location.pathname !== RUTA || !location.hash) return;
  const fragmento = new URLSearchParams(location.hash.slice(1));
  history.replaceState(history.state, '', RUTA);
  const token = fragmento.get('token');
  const email = fragmento.get('email');
  if (token && email) return { token, email };
}

let enlacePendiente = leerEnlace();

export default function ActivacionInstitucion() {
  const [enlace, establecerEnlace] = useState(() => enlacePendiente);
  const [exito, establecerExito] = useState(false);
  const [errores, establecerErrores] = useState<{ password?: string; password_confirmation?: string }>({});
  const [aviso, establecerAviso] = useState('');
  const [tono, establecerTono] = useState<TonoAcceso>('error');
  const [ocupado, establecerOcupado] = useState(false);
  const [espera, establecerEspera] = useState(0);
  const operacion = useRef<AbortController | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    enlacePendiente = undefined;
    const politica = document.createElement('meta');
    politica.name = 'referrer';
    politica.content = 'same-origin';
    document.head.append(politica);
    const actualizar = () => {
      if (!location.hash) return;
      establecerEnlace(leerEnlace());
      establecerExito(false);
      establecerAviso('');
      establecerErrores({});
    };
    window.addEventListener('hashchange', actualizar);
    return () => {
      politica.remove();
      window.removeEventListener('hashchange', actualizar);
      operacion.current?.abort();
    };
  }, []);

  useEffect(() => titulo.current?.focus(), [exito, enlace]);

  useEffect(() => {
    if (espera === 0) return;
    const id = window.setTimeout(() => establecerEspera(0), espera * 1000);
    return () => window.clearTimeout(id);
  }, [espera]);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!enlace || operacion.current || espera) return;
    const datos = new FormData(evento.currentTarget);
    const password = String(datos.get('password') ?? '');
    const confirmacion = String(datos.get('password_confirmation') ?? '');
    const nuevos: typeof errores = {};
    if ([...password].length < 12) nuevos.password = 'Usa al menos 12 caracteres.';
    else if (new TextEncoder().encode(password).length > 72 || password.includes('\0')) {
      nuevos.password = 'Usa una contraseña más corta.';
    }
    if (!confirmacion || confirmacion !== password) nuevos.password_confirmation = 'Confirma la contraseña con el mismo valor.';
    establecerErrores(nuevos);
    establecerAviso('');
    const primero = Object.keys(nuevos)[0];
    if (primero) {
      const campo = evento.currentTarget.elements.namedItem(primero);
      if (campo instanceof HTMLElement) campo.focus();
      return;
    }

    const control = new AbortController();
    operacion.current = control;
    establecerOcupado(true);
    try {
      await solicitar('/sanctum/csrf-cookie', control.signal);
      await solicitar('/api/registro-institucion/activacion', control.signal, {
        email: enlace.email, token: enlace.token, password, password_confirmation: confirmacion,
      }, ['email', 'token', 'password', 'password_confirmation', 'solicitud']);
      if (!control.signal.aborted) {
        establecerEnlace(undefined);
        establecerExito(true);
      }
    } catch (error) {
      if (control.signal.aborted) return;
      if (error instanceof ErrorSesion && error.estado === 422 && (error.campos.includes('token') || error.campos.includes('email'))) {
        establecerEnlace(undefined);
        establecerTono('advertencia');
        establecerAviso(ENLACE_NO_DISPONIBLE);
        return;
      }
      if (error instanceof ErrorSesion && error.estado === 409) {
        establecerTono('advertencia');
        establecerAviso('No se pudo completar la vinculación. La solicitud sigue sin conceder acceso.');
        return;
      }
      if (error instanceof ErrorSesion && error.estado === 403) {
        establecerAviso('Esta cuenta no puede activarse con este enlace.');
        establecerTono('error');
        return;
      }
      if (error instanceof ErrorSesion && error.estado === 401) {
        establecerAviso('La sesión actual no corresponde a esta activación. Cierra la sesión e inténtalo de nuevo.');
        establecerTono('advertencia');
        return;
      }
      establecerAviso(mensajeSesion(error));
      establecerTono(tonoFalloAcceso(error));
      if (error instanceof ErrorSesion && error.estado === 429) establecerEspera(error.espera ?? 60);
    } finally {
      if (operacion.current === control) operacion.current = null;
      if (!control.signal.aborted) establecerOcupado(false);
    }
  };

  return (
    <MarcoAcceso>
      <h1 ref={titulo} tabIndex={-1} className="acceso__titulo">
        {exito ? 'Acceso activado' : 'Activa tu acceso institucional'}
      </h1>
      {exito ? (
        <div className="mt-4">
          <AvisoAcceso tono="confirmacion">Tu contraseña quedó definida. Ya puedes iniciar sesión.</AvisoAcceso>
          <Link to="/" className="acceso__accion mt-4 inline-flex min-h-12 items-center justify-center rounded-md px-4 text-sm font-semibold">
            Iniciar sesión
          </Link>
        </div>
      ) : !enlace ? (
        <div className="mt-4">
          <AvisoAcceso tono="advertencia">{aviso || ENLACE_NO_DISPONIBLE}</AvisoAcceso>
        </div>
      ) : (
        <form noValidate onSubmit={evento => void enviar(evento)} className="mt-5 grid gap-4" aria-busy={ocupado}>
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            Define la contraseña de {enlace.email}. El enlace se usa una sola vez.
          </p>
          <p id="regla-activacion" className="text-sm text-muted-foreground">Usa al menos 12 caracteres.</p>
          <div className="grid gap-2">
            <Etiqueta htmlFor="password">Contraseña</Etiqueta>
            <CampoContrasena id="password" name="password" required disabled={ocupado} autoComplete="new-password"
              etiqueta="contraseña" aria-invalid={Boolean(errores.password)}
              aria-describedby={errores.password ? 'password-error regla-activacion' : 'regla-activacion'}
              onChange={errores.password ? () => establecerErrores(actual => ({ ...actual, password: undefined })) : undefined} />
            {errores.password && <p id="password-error" role="alert" className="text-sm text-error">{errores.password}</p>}
          </div>
          <div className="grid gap-2">
            <Etiqueta htmlFor="password_confirmation">Confirma la contraseña</Etiqueta>
            <CampoContrasena id="password_confirmation" name="password_confirmation" required disabled={ocupado}
              autoComplete="new-password" etiqueta="confirmación de contraseña"
              aria-invalid={Boolean(errores.password_confirmation)}
              aria-describedby={errores.password_confirmation ? 'password_confirmation-error' : undefined}
              onChange={errores.password_confirmation
                ? () => establecerErrores(actual => ({ ...actual, password_confirmation: undefined })) : undefined} />
            {errores.password_confirmation && (
              <p id="password_confirmation-error" role="alert" className="text-sm text-error">{errores.password_confirmation}</p>
            )}
          </div>
          {aviso && <AvisoAcceso tono={tono}>{aviso}</AvisoAcceso>}
          {espera > 0 && <p role="status" className="text-sm text-muted-foreground">Podrás intentar de nuevo en {espera} segundos.</p>}
          <Button type="submit" disabled={ocupado || espera > 0} className="acceso__accion min-h-12 w-full">
            {ocupado ? 'Activando…' : 'Definir contraseña'}
          </Button>
        </form>
      )}
      <Link to="/" className="acceso__enlace mt-3 inline-flex min-h-11 items-center text-sm">Volver al inicio</Link>
    </MarcoAcceso>
  );
}
