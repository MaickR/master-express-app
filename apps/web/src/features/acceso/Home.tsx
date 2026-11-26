import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import Button from '@/features/acceso/BotonAcceso';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import SelectorTema from '@/shared/components/selector-tema';
import { ErrorSesion, mensajeSesion } from './cliente-sesion';
import AvisoAcceso, { tonoFalloAcceso, type TonoAcceso } from './aviso-acceso';
import CampoContrasena from './campo-contrasena';
import { useSesion } from './contexto-sesion';
import { paneles } from './destinos';
import { vistasRegistro } from './vistas-registro';

const Campo = Input as ComponentType<ComponentProps<'input'>>;
const Etiqueta = Label as ComponentType<ComponentProps<'label'>>;

export function MarcoAcceso({ children }: { children: ReactNode }) {
  return (

    <main className="acceso grid min-h-dvh place-items-center px-3 py-3 sm:px-8 sm:py-8">
      <div className="acceso__panel grid w-full min-w-0 text-card-foreground">
        <header className="acceso__marca flex min-w-0 items-center justify-between gap-2">
          <div className="acceso__identidad flex min-w-0 items-center gap-3 lg:flex-col lg:items-start lg:gap-6">
            <img src="/master-express.png" alt="" width={72} height={72}
              className="size-11 shrink-0 rounded-xl border border-border bg-marca-placa object-contain p-1 sm:size-14 lg:size-[76px] lg:p-2" />
            <div className="min-w-0">
              <p className="acceso__nombre font-heading text-sm font-bold leading-tight tracking-tight sm:text-xl lg:text-[2rem]">
                MasterExpress <span>Control</span>
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm lg:mt-3 lg:max-w-[23ch] lg:text-base">
                Cada ceremonia, organizada de principio a fin.
              </p>
            </div>
          </div>
          <SelectorTema className="acceso__tema border border-border bg-card text-card-foreground hover:bg-accent" />
        </header>
        <section className="acceso__contenido min-w-0">
          {children}
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const { estado, cerrar } = useSesion();

  if (estado.tipo === 'autenticado') {
    const roles = [...new Set(estado.identidad.roles)];
    if (roles.length === 1) return <Navigate to={paneles[roles[0]].ruta} replace />;

    return (
      <MarcoAcceso>
        <h1 className="font-heading text-3xl font-semibold">Selecciona un panel</h1>
        <p className="mt-2 break-words text-sm text-muted-foreground">Sesión iniciada como {estado.identidad.nombre}.</p>
        <div className="mt-6 grid gap-3">
          {roles.map(rol => (
            <Link key={rol} to={paneles[rol].ruta}
              className="flex min-h-12 items-center justify-between rounded-md border border-border px-4 text-sm font-semibold outline-offset-4 hover:bg-muted">
              {paneles[rol].nombre}<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ))}
        </div>
        <Button type="button" variant="ghost" className="mt-4 min-h-11 px-2" onClick={() => void cerrar()}>Cerrar sesión</Button>
      </MarcoAcceso>
    );
  }

  return <FormularioAcceso aviso={estado.tipo === 'anonimo' ? estado.aviso : undefined} />;
}

function FormularioAcceso({ aviso }: { aviso?: string }) {
  const { iniciar } = useSesion();
  const correo = useRef<HTMLInputElement>(null);
  const contrasena = useRef<HTMLInputElement>(null);
  const solicitando = useRef(false);
  const [ocupado, establecerOcupado] = useState(false);
  const [campoInvalido, establecerCampoInvalido] = useState<'correo' | 'contrasena'>();
  const [error, establecerError] = useState('');
  const [tono, establecerTono] = useState<TonoAcceso>('error');
  const [reintentarEn, establecerReintentarEn] = useState(0);

  useEffect(() => {
    if (!reintentarEn) return;
    const temporizador = window.setTimeout(() => {
      establecerReintentarEn(0);
      establecerError('');
    }, reintentarEn);
    return () => window.clearTimeout(temporizador);
  }, [reintentarEn]);

  const limpiarErrorCampo = (campo: typeof campoInvalido) => {
    if (campo !== campoInvalido) return;
    establecerCampoInvalido(undefined);
    establecerError('');
  };

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (solicitando.current || reintentarEn || !correo.current || !contrasena.current) return;
    const email = correo.current.value.trim();
    const password = contrasena.current.value;
    const remember = new FormData(evento.currentTarget).has('remember');
    establecerCampoInvalido(undefined);
    establecerError('');

    if (!email || !correo.current.validity.valid) {
      establecerCampoInvalido('correo');
      establecerError('Ingresa un correo electrónico válido.');
      correo.current.focus();
      return;
    }
    if (!password) {
      establecerCampoInvalido('contrasena');
      establecerError('Ingresa tu contraseña.');
      contrasena.current.focus();
      return;
    }

    solicitando.current = true;
    establecerOcupado(true);
    try {
      await iniciar({ email, password, remember });
    } catch (fallo) {
      establecerError(mensajeSesion(fallo));
      establecerTono(tonoFalloAcceso(fallo));
      if (fallo instanceof ErrorSesion && fallo.estado === 429) {
        establecerReintentarEn((fallo.espera ?? 60) * 1000);
      }
    } finally {
      solicitando.current = false;
      establecerOcupado(false);
    }
  };

  return (
    <MarcoAcceso>
      <h1 className="acceso__titulo">Iniciar sesión</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">Ingresa con el correo y la contraseña de tu cuenta interna.</p>
      <form className="mt-4 grid gap-2.5 sm:mt-6 sm:gap-4" onSubmit={enviar} noValidate aria-busy={ocupado}>
        <div className="grid gap-2">
          <Etiqueta htmlFor="correo">Correo electrónico</Etiqueta>
          <Campo ref={correo} id="correo" name="email" type="email" autoComplete="username" required
            onChange={() => limpiarErrorCampo('correo')}
            maxLength={255} disabled={ocupado} aria-invalid={campoInvalido === 'correo'}
            aria-describedby={campoInvalido === 'correo' ? 'error-correo' : undefined} className="acceso__campo h-12 px-3.5 md:text-base sm:h-[3.25rem]" />
          {campoInvalido === 'correo' && <p id="error-correo" role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <div className="grid gap-2">

          <Etiqueta htmlFor="contrasena">Contraseña</Etiqueta>
          <CampoContrasena ref={contrasena} id="contrasena" name="password" autoComplete="current-password"
            onChange={() => limpiarErrorCampo('contrasena')}
            etiqueta="contraseña" required disabled={ocupado} aria-invalid={campoInvalido === 'contrasena'}
            aria-describedby={campoInvalido === 'contrasena' ? 'error-contrasena' : undefined} />
          {campoInvalido === 'contrasena' && <p id="error-contrasena" role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <div>
          <Link to="/recuperar-contrasena" className="acceso__enlace inline-flex min-h-11 items-center text-sm">
            ¿Olvidaste tu contraseña?
          </Link>
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="remember" disabled={ocupado}
              className="size-5 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
            Mantener sesión iniciada
          </label>
        </div>
        {!campoInvalido && (error || aviso) && (
          <AvisoAcceso id="mensaje-acceso" tono={error ? tono : 'advertencia'}>{error || aviso}</AvisoAcceso>
        )}
        <Button type="submit" disabled={ocupado || reintentarEn > 0} className="acceso__accion h-12 w-full text-base font-semibold sm:h-[3.25rem]">
          {ocupado ? 'Iniciando sesión…' : 'Iniciar sesión'}
          {ocupado ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:hidden" /> : <ArrowRight aria-hidden="true" />}
        </Button>
      </form>
      <span role="status" className="sr-only">{ocupado ? "Iniciando sesión…" : ""}</span>
      <nav aria-label="Vistas previas de registro" className="mt-4 grid grid-cols-2 gap-2.5 border-t border-border pt-3">
        {vistasRegistro.map(vista => (
          <Link key={vista.ruta} to={vista.ruta}
            className="acceso__enlace inline-flex min-h-11 min-w-0 items-center justify-center rounded-md border border-border px-2 py-2 text-center text-sm hover:bg-accent hover:text-accent-foreground">
            {vista.enlace}
          </Link>
        ))}
      </nav>
    </MarcoAcceso>
  );
}
