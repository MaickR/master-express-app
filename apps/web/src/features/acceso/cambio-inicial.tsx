import { useState, type FormEvent } from 'react';
import Button from './BotonAcceso';
import { ErrorSesion, solicitar } from './cliente-sesion';

export default function CambioInicial({ alTerminar, alCerrar }: { alTerminar: () => void; alCerrar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const formulario = evento.currentTarget;
    const campos = new FormData(formulario);
    setOcupado(true);
    setAviso('');
    try {
      const signal = AbortSignal.timeout(15000);
      await solicitar('/sanctum/csrf-cookie', signal);
      await solicitar('/api/mi-perfil/contrasena', signal, {
        current_password: campos.get('current_password'),
        password: campos.get('password'),
        password_confirmation: campos.get('password_confirmation'),
      }, ['clave.current_password', 'clave.password', 'clave.password_confirmation']);
      formulario.reset();
      alTerminar();
    } catch (error) {
      setAviso(error instanceof ErrorSesion && error.estado === 422
        ? 'Verifica la contraseña temporal y confirma una nueva, distinta, de al menos 12 caracteres y hasta 72 bytes.'
        : 'No se pudo guardar. Vuelve a intentar o cierra sesión.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="mx-auto my-8 w-[calc(100%-2rem)] max-w-md space-y-4 rounded-xl border bg-card p-5 text-card-foreground sm:p-8">
      <h1 className="text-xl font-semibold">Cambia tu contraseña temporal</h1>
      <p className="text-sm text-muted-foreground">Elige tu contraseña definitiva para continuar. Después deberás iniciar sesión con ella.</p>
      <form className="space-y-4" onSubmit={guardar}>
        {[['current_password', 'Contraseña temporal'], ['password', 'Nueva contraseña'], ['password_confirmation', 'Confirma la nueva contraseña']].map(([campo, etiqueta]) => (
          <div className="space-y-2" key={campo}>
            <label className="text-sm font-medium" htmlFor={campo}>{etiqueta}</label>
            <input className="min-h-11 w-full rounded-md border border-input bg-background px-3" id={campo} name={campo}
              type="password" required minLength={campo === 'current_password' ? undefined : 12}
              autoComplete={campo === 'current_password' ? 'current-password' : 'new-password'} />
          </div>
        ))}
        {aviso && <p role="alert" className="text-sm text-destructive">{aviso}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar contraseña'}</Button>
          <Button type="button" disabled={ocupado} onClick={alCerrar}>Cerrar sesión</Button>
        </div>
      </form>
    </main>
  );
}
