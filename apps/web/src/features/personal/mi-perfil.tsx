import type { ComponentType, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, UserRound } from 'lucide-react';
import PanelOperativo from '@/shared/components/PanelOperativo';
import { Card as CardBase, CardContent as CardContentBase, CardHeader as CardHeaderBase, CardTitle as CardTitleBase } from '@/shared/ui/card';
import { Button as ButtonBase } from '@/shared/ui/button';
import { Input as InputBase } from '@/shared/ui/input';
import { Label as LabelBase } from '@/shared/ui/label';
import { useSesion } from '@/features/acceso/contexto-sesion';
import { ErrorSesion, type Identidad } from '@/features/acceso/cliente-sesion';
import { consultarPerfil, cambiarPersonal, leerFormulario, errorPersonal } from './cliente-personal';
const Card = CardBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const CardHeader = CardHeaderBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const CardTitle = CardTitleBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const CardContent = CardContentBase as ComponentType<HTMLAttributes<HTMLDivElement>>;
const Input = InputBase as ComponentType<InputHTMLAttributes<HTMLInputElement>>;
const Label = LabelBase as ComponentType<LabelHTMLAttributes<HTMLLabelElement>>;
const Button = ButtonBase as ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;

export default function MiPerfil({ identidad }: { identidad: Identidad }) {
  useEffect(() => { document.getElementById('titulo-mi-perfil')?.focus(); }, []);
  const { comprobar } = useSesion();
  const cliente = useQueryClient();
  const [aviso, setAviso] = useState('');
  const [nombre, setNombre] = useState<string | null>(null);
  const datos = useQuery({ queryKey: ['mi-perfil', identidad.id], queryFn: ({ signal }) => consultarPerfil(signal), retry: false });
  const guardar = useMutation({
    mutationFn: () => cambiarPersonal('/api/mi-perfil', { nombre: nombre ?? datos.data?.nombre }, ['perfil.nombre']),
    onSuccess: async () => {
      setAviso('Tu perfil se guardó correctamente.');
      setNombre(null);
      await cliente.invalidateQueries({ queryKey: ['mi-perfil', identidad.id] });
      comprobar();
    },
  });
  const clave = useMutation({
    mutationFn: (datosClave: Record<string, string>) => cambiarPersonal('/api/mi-perfil/contrasena', datosClave,
      ['clave.current_password', 'clave.password', 'clave.password_confirmation']),
    onSuccess: () => { comprobar(); },
  });
  const grupos = [{ id: 'cuenta', destinos: [
    { id: 'panel', label: 'Volver al panel', icon: Home, url: identidad.roles.includes('administrador') ? '/AdminDashboard' : '/ColaboradorDashboard' },
    { id: 'perfil', label: 'Mi perfil', icon: UserRound, url: '/MiPerfil' },
  ] }];
  function cambiarClave(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!window.confirm('¿Cambiar tu contraseña y cerrar todas tus sesiones? Después debes volver a ingresar.')) return;
    const formulario = evento.currentTarget;
    const entrada = leerFormulario(formulario);
    clave.mutate(entrada, { onSuccess: () => formulario.reset() });
  }
  const erroresClave = clave.error instanceof ErrorSesion ? clave.error.campos : [];
  return (
    <PanelOperativo grupos={grupos} activo="perfil" rol={identidad.roles.includes('administrador') ? 'Administrador' : 'Colaborador'} nombre={identidad.nombre}>
      <div className="panel-pagina space-y-6 [&_input]:min-h-11 [&_button]:min-h-11">
        <div className="portal-encabezado"><h1 id="titulo-mi-perfil" tabIndex={-1}>Mi perfil</h1><p>Administra tus datos y la seguridad de tu cuenta.</p></div>
        {datos.isPending && <p role="status">Cargando tu perfil…</p>}
        {datos.isError && <div role="alert">{errorPersonal(datos.error)} <Button onClick={() => void datos.refetch()}>Reintentar</Button></div>}
        {datos.data && <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>Información personal</CardTitle></CardHeader><CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={evento => { evento.preventDefault(); setAviso(''); guardar.mutate(); }}>
              <div className="space-y-2"><Label htmlFor="nombre-perfil">Nombre</Label>
                <Input id="nombre-perfil" name="nombre" autoComplete="name" required maxLength={255}
                  value={nombre ?? datos.data.nombre} onChange={evento => setNombre(evento.target.value)}
                  aria-invalid={guardar.isError} aria-describedby={guardar.isError ? 'error-nombre' : undefined} />
                {guardar.isError && <p id="error-nombre" role="alert" className="text-sm text-destructive">{guardar.error instanceof ErrorSesion && guardar.error.estado === 422 ? 'Ingresa un nombre entre 1 y 255 caracteres.' : errorPersonal(guardar.error)}</p>}
              </div>
              <Button disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</Button>
              <p role="status" className="text-sm">{aviso}</p>
            </form>
            <dl className="space-y-3 text-sm [overflow-wrap:anywhere]">
              <div><dt className="text-muted-foreground">Correo electrónico</dt><dd>{datos.data.correo}</dd></div>
              <div><dt className="text-muted-foreground">Estado del correo</dt><dd>{datos.data.correo_verificado ? 'Verificado' : 'Sin verificar'}</dd></div>
              <div><dt className="text-muted-foreground">Roles asignados</dt><dd>{datos.data.roles.join(', ')}</dd></div>
              <div><dt className="text-muted-foreground">Estado de la cuenta</dt><dd>{datos.data.activa ? 'Activa' : 'Suspendida'}{datos.data.principal && ' · Cuenta principal protegida'}</dd></div>
            </dl>
            <p className="text-sm text-muted-foreground">Los roles se administran en Cuentas internas. El cambio de correo requiere verificar el nuevo buzón y todavía no está habilitado.</p>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Seguridad de acceso</CardTitle></CardHeader><CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">Cambia tu contraseña cuando lo necesites. Usa al menos 12 caracteres y hasta 72 bytes. El cambio cerrará todas tus sesiones.</p>
            <form onSubmit={cambiarClave} className="space-y-4">
              {[
                ['current_password', 'Contraseña actual', 'current-password'],
                ['password', 'Nueva contraseña', 'new-password'],
                ['password_confirmation', 'Confirma la nueva contraseña', 'new-password'],
              ].map(([campo, etiqueta, auto]) => <div key={campo} className="space-y-2">
                <Label htmlFor={`perfil-${campo}`}>{etiqueta}</Label>
                <Input id={`perfil-${campo}`} name={campo} type="password" autoComplete={auto} required
                  minLength={campo === 'current_password' ? undefined : 12} maxLength={72}
                  aria-invalid={erroresClave.includes(`clave.${campo}`)}
                  aria-describedby={erroresClave.includes(`clave.${campo}`) ? `error-${campo}` : undefined} />
                {erroresClave.includes(`clave.${campo}`) && <p id={`error-${campo}`} className="text-sm text-destructive">{campo === 'current_password' ? 'Verifica tu contraseña actual.' : 'Revisa la longitud y confirma que ambas contraseñas coincidan.'}</p>}
              </div>)}
              {clave.isError && <p role="alert" className="text-sm text-destructive">{errorPersonal(clave.error)}</p>}
              <Button disabled={clave.isPending}>{clave.isPending ? 'Cambiando…' : 'Cambiar contraseña'}</Button>
            </form>
            <Link className="inline-block text-sm underline underline-offset-4" to="/recuperar-contrasena">Recuperar mi contraseña</Link>
          </CardContent></Card>
        </div>}
      </div>
    </PanelOperativo>
  );
}
