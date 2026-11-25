import { useEffect, useRef, useState, type ComponentProps, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
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
    <main className="grid min-h-dvh grid-rows-[auto_1fr] bg-background lg:grid-rows-1 lg:grid-cols-[minmax(320px,0.85fr)_minmax(520px,1.15fr)]">
      <header className="relative flex items-center gap-3 border-b border-sidebar-border bg-sidebar py-5 pl-5 pr-20 text-sidebar-foreground sm:pl-10 lg:flex-col lg:items-start lg:justify-between lg:border-b-0 lg:border-r lg:py-12 lg:pl-12">
        <div className="flex items-center gap-3">
          <img src="/master-express.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-lg bg-marca-placa object-contain p-1" />
          <p className="text-base font-semibold leading-tight sm:text-lg">MasterExpress <strong className="block text-sidebar-marca">Control</strong></p>
        </div>
        <p className="hidden max-w-sm font-heading text-4xl font-semibold leading-tight lg:block">
          Gestión de ceremonias de grado
        </p>
        <div aria-hidden="true" className="hidden h-1 w-14 rounded bg-sidebar-marca lg:block" />
        <SelectorTema className="absolute right-4 top-5 border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-sidebar-ring lg:right-8 lg:top-12" />
      </header>
      <div className="grid content-start justify-items-center px-4 py-9 sm:px-10 sm:py-14 lg:content-center lg:px-16">
        <section className="w-full max-w-[440px] rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-9">
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
      <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Iniciar sesión</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Usa el correo de tu cuenta interna para acceder a tu panel.</p>
      <form className="mt-7 space-y-5" onSubmit={enviar} noValidate aria-busy={ocupado}>
        <div className="space-y-2">
          <Etiqueta htmlFor="correo">Correo electrónico</Etiqueta>
          <Campo ref={correo} id="correo" name="email" type="email" autoComplete="username" required
            maxLength={255} disabled={ocupado} aria-invalid={campoInvalido === 'correo'}
            aria-describedby={campoInvalido === 'correo' ? 'mensaje-acceso' : undefined} className="h-12 bg-background" />
        </div>
        <div className="space-y-2">
          <Etiqueta htmlFor="contrasena">Contraseña</Etiqueta>
          <div className="relative">
            <Campo ref={contrasena} id="contrasena" name="password" type={visible ? 'text' : 'password'}
              autoComplete="current-password" required disabled={ocupado} aria-invalid={campoInvalido === 'contrasena'}
              aria-describedby={campoInvalido === 'contrasena' ? 'mensaje-acceso' : undefined}
              className="h-12 bg-background pr-12" />
            <Button type="button" variant="ghost" size="icon" disabled={ocupado}
              className="absolute right-0.5 top-0.5 size-11 text-muted-foreground"
              aria-controls="contrasena" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => establecerVisible(!visible)}>
              {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
        </div>
        {(error || aviso) && (
          <p id="mensaje-acceso" role="alert" className="rounded-lg border border-destructive/40 bg-error-suave px-3 py-2 text-sm text-error">
            {error || aviso}
          </p>
        )}
        <Button type="submit" disabled={ocupado || reintentarEn > 0} className="h-12 w-full">
          {ocupado ? 'Iniciando sesión…' : 'Ingresar'}
          {!ocupado && <ArrowRight aria-hidden="true" />}
        </Button>
      </form>
    </MarcoAcceso>
  );
}
