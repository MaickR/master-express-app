import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type FormEvent } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import Button from './BotonAcceso';
import { MarcoAcceso } from './Home';
import AvisoAcceso, { tonoFalloAcceso, type TonoAcceso } from './aviso-acceso';
import CampoContrasena from './campo-contrasena';
import { ErrorSesion, mensajeSesion, recuperarContrasena } from './cliente-sesion';

const Campo = Input as ComponentType<ComponentProps<'input'>>;
const Etiqueta = Label as ComponentType<ComponentProps<'label'>>;
const RUTA_RESTABLECIMIENTO = '/restablecer-contrasena';
const ENLACE_INVALIDO = 'El enlace no es válido o venció. Solicita uno nuevo.';
const CORREO_INVALIDO = 'Ingresa un correo electrónico válido.';
type CampoRecuperacion = 'email' | 'password' | 'password_confirmation';
type Errores = Partial<Record<CampoRecuperacion, string>>;

function leerEnlace() {
  if (location.pathname !== RUTA_RESTABLECIMIENTO || !location.hash) return;
  const fragmento = new URLSearchParams(location.hash.slice(1));
  history.replaceState(history.state, '', RUTA_RESTABLECIMIENTO);
  const token = fragmento.get('token');
  const email = fragmento.get('email');
  if (token && email) return { token, email };
}

let enlacePendiente = leerEnlace();

export default function Recuperacion({ modo }: { modo: 'solicitar' | 'restablecer' }) {
  const restablecer = modo === 'restablecer';
  const [enlace, establecerEnlace] = useState(() => restablecer ? enlacePendiente : undefined);
  const [exito, establecerExito] = useState(false);
  const [errores, establecerErrores] = useState<Errores>({});
  const [aviso, establecerAviso] = useState('');
  const [tono, establecerTono] = useState<TonoAcceso>('error');
  const [ocupado, establecerOcupado] = useState(false);
  const [espera, establecerEspera] = useState(0);
  const operacion = useRef<AbortController>();
  const titulo = useRef<HTMLHeadingElement>(null);
  const campoPendiente = useRef<HTMLInputElement | null>(null);
  const enlaceInvalido = restablecer && !enlace && !exito;

  useEffect(() => {
    if (!restablecer) return () => operacion.current?.abort();

    enlacePendiente = undefined;
    const politica = document.createElement('meta');
    politica.name = 'referrer';
    politica.content = 'same-origin';
    document.head.append(politica);

    const actualizarEnlace = () => {
      if (!location.hash) return;
      operacion.current?.abort();
      operacion.current = undefined;
      campoPendiente.current = null;
      establecerOcupado(false);
      establecerAviso('');
      establecerErrores({});
      establecerExito(false);
      establecerEnlace(leerEnlace());
    };
    window.addEventListener('hashchange', actualizarEnlace);
    return () => {
      window.removeEventListener('hashchange', actualizarEnlace);
      politica.remove();
      operacion.current?.abort();
    };
  }, [restablecer]);

  useEffect(() => titulo.current?.focus(), [exito, enlaceInvalido]);

  useEffect(() => {
    if (ocupado) return;
    campoPendiente.current?.focus();
    campoPendiente.current = null;
  }, [ocupado]);

  useEffect(() => {
    if (espera === 0) return;
    const temporizador = window.setTimeout(() => {
      establecerEspera(0);
      establecerAviso('');
    }, espera * 1000);
    return () => window.clearTimeout(temporizador);
  }, [espera]);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (operacion.current || espera || (restablecer && !enlace)) return;

    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const email = String(datos.get('email') ?? '').trim();
    const password = String(datos.get('password') ?? '');
    const confirmacion = String(datos.get('password_confirmation') ?? '');
    const correo = formulario.elements.namedItem('email');
    const erroresNuevos: Errores = {};

    if (restablecer) {
      if ([...password].length < 12) erroresNuevos.password = 'Usa al menos 12 caracteres.';
      else if (new TextEncoder().encode(password).length > 72) erroresNuevos.password = 'Usa una contraseña más corta.';
      if (!confirmacion || confirmacion !== password) {
        erroresNuevos.password_confirmation = 'Confirma la contraseña con el mismo valor.';
      }
    } else if (correo instanceof HTMLInputElement && (!email || !correo.validity.valid)) {
      erroresNuevos.email = CORREO_INVALIDO;
    }

    establecerErrores(erroresNuevos);
    establecerAviso('');
    const primerError = Object.keys(erroresNuevos)[0];
    if (primerError) {
      const campo = formulario.elements.namedItem(primerError);
      if (campo instanceof HTMLInputElement) campo.focus();
      return;
    }

    const control = new AbortController();
    operacion.current = control;
    establecerOcupado(true);
    try {
      await recuperarContrasena(restablecer && enlace
        ? { ...enlace, password, password_confirmation: confirmacion }
        : { email }, control.signal);
      if (!control.signal.aborted) {
        establecerEnlace(undefined);
        establecerExito(true);
      }
    } catch (error) {
      if (control.signal.aborted) return;
      if (error instanceof ErrorSesion && error.estado === 422) {
        if (restablecer && (error.campos.includes('token') || error.campos.includes('email'))) {
          establecerEnlace(undefined);
        } else {
          const erroresServidor: Errores = {};
          if (!restablecer && error.campos.includes('email')) erroresServidor.email = CORREO_INVALIDO;
          if (restablecer && error.campos.includes('password')) {
            erroresServidor.password = 'Usa al menos 12 caracteres. Si la contraseña es muy larga, acórtala.';
          }
          if (restablecer && error.campos.includes('password_confirmation')) {
            erroresServidor.password_confirmation = 'Confirma la contraseña con el mismo valor.';
          }
          const primerCampo = Object.keys(erroresServidor)[0];
          if (primerCampo) {
            establecerErrores(erroresServidor);
            const campo = formulario.elements.namedItem(primerCampo);
            if (campo instanceof HTMLInputElement) campoPendiente.current = campo;
          } else {
            establecerTono('error');
            establecerAviso('Revisa los datos del formulario e inténtalo de nuevo.');
          }
        }
      } else {
        establecerAviso(mensajeSesion(error));
        establecerTono(tonoFalloAcceso(error));
        if (error instanceof ErrorSesion && error.estado === 429) establecerEspera(error.espera ?? 60);
      }
    } finally {
      if (operacion.current === control) operacion.current = undefined;
      if (!control.signal.aborted) establecerOcupado(false);
    }
  };

  const campo = (nombre: CampoRecuperacion, etiqueta: string) => {
    const error = errores[nombre];
    const ayuda = nombre === 'password' ? 'regla-clave' : undefined;
    const descripcion = error ? [ayuda, nombre + '-error'].filter(Boolean).join(' ') : ayuda;
    const props = {
      id: nombre, name: nombre, required: true, disabled: ocupado,
      'aria-invalid': Boolean(error), 'aria-describedby': descripcion,
      onChange: error ? () => establecerErrores(anteriores => ({ ...anteriores, [nombre]: undefined })) : undefined,
    };
    return (
      <div className="grid gap-2">
        <Etiqueta htmlFor={nombre}>{etiqueta}</Etiqueta>
        {nombre === 'email' ? (
          <Campo {...props} type="email" autoComplete="email" maxLength={255}
            className="acceso__campo h-12 px-3.5 md:text-base sm:h-[3.25rem]" />
        ) : (
          <CampoContrasena {...props} autoComplete="new-password"
            etiqueta={nombre === 'password' ? 'nueva contraseña' : 'confirmación de contraseña'} />
        )}
        {error && <p id={nombre + '-error'} role="alert" className="text-sm text-error">{error}</p>}
      </div>
    );
  };

  return (
    <MarcoAcceso>
      <h1 ref={titulo} tabIndex={-1} className="acceso__titulo">
        {exito ? (restablecer ? 'Contraseña actualizada' : 'Revisa tu correo')
          : restablecer ? 'Crea una nueva contraseña' : 'Recupera tu contraseña'}
      </h1>
      {exito ? (
        <div className="mt-4">
          <AvisoAcceso tono={restablecer ? 'confirmacion' : 'informacion'}>
            {restablecer ? 'Ya puedes iniciar sesión con tu nueva contraseña.'
              : 'Si corresponde, recibirás un enlace para restablecer tu contraseña.'}
          </AvisoAcceso>
        </div>
      ) : enlaceInvalido ? (
        <div className="mt-4">
          <AvisoAcceso tono="advertencia">{ENLACE_INVALIDO}</AvisoAcceso>
          <Link className="acceso__accion mt-4 inline-flex min-h-12 items-center justify-center rounded-md px-4 text-sm font-semibold" to="/recuperar-contrasena" replace>
            Solicitar un enlace nuevo
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={enviar} aria-busy={ocupado} className="mt-5 grid gap-4">
          {restablecer ? (
            <>
              <p id="regla-clave" className="text-sm text-muted-foreground">Usa al menos 12 caracteres.</p>
              {campo('password', 'Nueva contraseña')}
              {campo('password_confirmation', 'Confirma la contraseña')}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Escribe el correo de tu cuenta para solicitar un enlace.</p>
              {campo('email', 'Correo electrónico')}
            </>
          )}
          {aviso && <AvisoAcceso tono={tono}>{aviso}</AvisoAcceso>}
          <Button type="submit" disabled={ocupado || espera > 0} className="acceso__accion h-12 w-full text-base font-semibold sm:h-[3.25rem]">
            {ocupado ? 'Enviando…' : restablecer ? 'Guardar nueva contraseña' : 'Solicitar enlace'}
            {ocupado && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:hidden" />}
          </Button>
        </form>
      )}
      <Link to="/" replace className="acceso__enlace mt-3 inline-flex min-h-11 items-center gap-2 text-sm">
        <ArrowLeft aria-hidden="true" className="size-4" /> Volver a iniciar sesión
      </Link>
      <span role="status" className="sr-only">{ocupado ? "Enviando…" : ""}</span>
    </MarcoAcceso>
  );
}
