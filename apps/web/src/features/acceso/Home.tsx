import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import Button from '@/features/acceso/BotonAcceso';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import SelectorTema from '@/shared/components/selector-tema';
import { ErrorSesion, mensajeSesion } from './cliente-sesion';
import { useSesion } from './contexto-sesion';
import { paneles } from './destinos';

const Campo = Input as ComponentType<ComponentProps<'input'>>;
const Etiqueta = Label as ComponentType<ComponentProps<'label'>>;

export function MarcoAcceso({ children }: { children: ReactNode }) {
  return (
    <main className="acceso grid min-h-dvh place-items-center px-3 py-5 sm:px-8 sm:py-10">
      <div className="acceso__panel w-full max-w-xl rounded-2xl border border-border bg-card text-card-foreground">
        <header className="acceso__marca flex items-center justify-between gap-2 rounded-t-2xl border-b border-border bg-muted px-4 py-4 sm:gap-5 sm:px-12 sm:py-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <img src="/master-express.png" alt="" width={72} height={72}
              className="size-12 shrink-0 rounded-xl border border-border bg-marca-placa object-contain p-1.5 sm:size-[72px] sm:p-2" />
            <div className="min-w-0">
              <p className="font-heading text-base font-bold leading-tight tracking-tight sm:text-2xl">
                MasterExpress <span className="text-primary">Control</span>
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">Gestión de ceremonias de grado</p>
            </div>
          </div>
          <SelectorTema className="border border-border bg-card text-card-foreground" />
        </header>
        <section className="px-4 pb-6 pt-5 sm:px-12 sm:pb-10 sm:pt-9">
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
  const [visible, establecerVisible] = useState(false);
  const [campoInvalido, establecerCampoInvalido] = useState<'correo' | 'contrasena'>();
  const [error, establecerError] = useState('');
  const [reintentarEn, establecerReintentarEn] = useState(0);

  useEffect(() => {
    if (!reintentarEn) return;
    const temporizador = window.setTimeout(() => establecerReintentarEn(0), reintentarEn);
    return () => window.clearTimeout(temporizador);
  }, [reintentarEn]);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (solicitando.current || reintentarEn || !correo.current || !contrasena.current) return;
    const email = correo.current.value.trim();
    const password = contrasena.current.value;
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
      await iniciar({ email, password });
    } catch (fallo) {
      establecerError(mensajeSesion(fallo));
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
      <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-[2.625rem] sm:leading-tight">Iniciar sesión</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">Ingresa con el correo y la contraseña de tu cuenta interna.</p>
      <form className="mt-5 grid gap-4 sm:mt-8 sm:gap-5" onSubmit={enviar} noValidate aria-busy={ocupado}>
        <div className="grid gap-2">
          <Etiqueta htmlFor="correo">Correo electrónico</Etiqueta>
          <Campo ref={correo} id="correo" name="email" type="email" autoComplete="username" required
            maxLength={255} disabled={ocupado} aria-invalid={campoInvalido === 'correo'}
            aria-describedby={campoInvalido === 'correo' ? 'mensaje-acceso' : undefined} className="h-12 bg-background px-3.5 md:text-base sm:h-14" />
        </div>
        <div className="grid gap-2">
          <Etiqueta htmlFor="contrasena">Contraseña</Etiqueta>
          <div className="relative">
            <Campo ref={contrasena} id="contrasena" name="password" type={visible ? 'text' : 'password'}
              autoComplete="current-password" required disabled={ocupado} aria-invalid={campoInvalido === 'contrasena'}
              aria-describedby={campoInvalido === 'contrasena' ? 'mensaje-acceso' : undefined}
              className="h-12 bg-background pl-3.5 pr-14 md:text-base sm:h-14" />
            <Button type="button" variant="ghost" size="icon" disabled={ocupado}
              className="absolute right-1 top-1/2 size-11 -translate-y-1/2 text-muted-foreground [&_svg]:size-5"
              aria-controls="contrasena" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => establecerVisible(!visible)}>
              {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
        </div>
        {(error || aviso) && (
          <p id="mensaje-acceso" role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-error-suave p-3 text-sm text-error">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            <span>{error || aviso}</span>
          </p>
        )}
        <Button type="submit" disabled={ocupado || reintentarEn > 0} className="h-12 w-full text-base font-semibold sm:h-14">
          {ocupado ? 'Iniciando sesión…' : 'Iniciar sesión'}
          {ocupado ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <ArrowRight aria-hidden="true" />}
        </Button>
      </form>
    </MarcoAcceso>
  );
}
