import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import Button from './BotonAcceso';
import { MarcoAcceso } from './Home';
import AvisoAcceso from './aviso-acceso';
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
  const [ocupado, establecerOcupado] = useState(false);
  const [espera, establecerEspera] = useState(0);
  const operacion = useRef<AbortController>();
  const titulo = useRef<HTMLHeadingElement>(null);

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

  useEffect(() => titulo.current?.focus(), [exito]);

  useEffect(() => {
    if (espera === 0) return;
    const temporizador = window.setTimeout(() => establecerEspera(0), espera * 1000);
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
        } else if (!restablecer && error.campos.includes('email')) {
          establecerErrores({ email: CORREO_INVALIDO });
        } else {
          establecerErrores({
            password: error.campos.includes('password') ? 'Usa al menos 12 caracteres. Si la contraseña es muy larga, acórtala.' : undefined,
            password_confirmation: error.campos.includes('password_confirmation')
              ? 'Confirma la contraseña con el mismo valor.' : undefined,
          });
          if (error.campos.length === 0) establecerAviso('Revisa los datos del formulario e inténtalo de nuevo.');
        }
      } else {
        establecerAviso(mensajeSesion(error));
        if (error instanceof ErrorSesion && error.estado === 429) establecerEspera(error.espera ?? 60);
      }
    } finally {
      if (operacion.current === control) operacion.current = undefined;
      if (!control.signal.aborted) establecerOcupado(false);
    }
  };

  const campo = (nombre: CampoRecuperacion, etiqueta: string) => (
    <div className="grid gap-2">
      <Etiqueta htmlFor={nombre}>{etiqueta}</Etiqueta>
      <Campo id={nombre} name={nombre} type={nombre === 'email' ? 'email' : 'password'}
        autoComplete={nombre === 'email' ? 'email' : 'new-password'} required disabled={ocupado}
        maxLength={nombre === 'email' ? 255 : undefined} aria-invalid={Boolean(errores[nombre])}
        aria-describedby={errores[nombre] ? nombre + '-error' : nombre === 'password' ? 'regla-clave' : undefined}
        className="h-12 bg-background px-3.5 md:text-base sm:h-14" />
      {errores[nombre] && <p id={nombre + '-error'} role="alert" className="text-sm text-error">{errores[nombre]}</p>}
    </div>
  );

  return (
    <MarcoAcceso>
      <h1 ref={titulo} tabIndex={-1} className="font-heading text-3xl font-bold tracking-tight">
        {exito ? (restablecer ? 'Contraseña actualizada' : 'Revisa tu correo')
          : restablecer ? 'Crea una nueva contraseña' : 'Recupera tu contraseña'}
      </h1>
      {exito ? (
        <div role="status" className="mt-4 flex items-start gap-3 text-sm text-foreground">
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <p>{restablecer ? 'Ya puedes iniciar sesión con tu nueva contraseña.'
            : 'Si el correo está asociado a una cuenta interna, recibirás un enlace para restablecer tu contraseña.'}</p>
        </div>
      ) : restablecer && !enlace ? (
        <div className="mt-4">
          <AvisoAcceso>{ENLACE_INVALIDO}</AvisoAcceso>
          <Link className="inline-flex min-h-11 items-center font-medium text-primary underline" to="/recuperar-contrasena" replace>
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
              <p className="text-sm text-muted-foreground">Escribe el correo de tu cuenta interna para solicitar un enlace.</p>
              {campo('email', 'Correo electrónico')}
            </>
          )}
          {aviso && <AvisoAcceso>{aviso}</AvisoAcceso>}
          <Button type="submit" disabled={ocupado || espera > 0} className="h-12 w-full text-base font-semibold">
            {ocupado ? 'Enviando…' : restablecer ? 'Guardar nueva contraseña' : 'Solicitar enlace'}
            {ocupado && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          </Button>
        </form>
      )}
      <Link to="/" replace className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
        <ArrowLeft aria-hidden="true" className="size-4" /> Volver a iniciar sesión
      </Link>
    </MarcoAcceso>
  );
}
