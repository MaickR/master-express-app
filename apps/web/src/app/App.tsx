import './App.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import Button from '@/features/acceso/BotonAcceso';
import { Toaster } from '@/shared/ui/toaster';
import { queryClientInstance } from '@/shared/lib/query-client';
import VisualEditAgent from '@/integrations/base44/VisualEditAgent';
import Home, { MarcoAcceso } from '@/features/acceso/Home';
import ProveedorSesion from '@/features/acceso/ProveedorSesion';
import Recuperacion from '@/features/acceso/recuperacion';
import ActivacionInstitucion from '@/features/acceso/activacion-institucion';
import RegistroVistaPrevia from '@/features/acceso/registro-vista-previa';
import { vistasRegistro } from '@/features/acceso/vistas-registro';
import { useSesion } from '@/features/acceso/contexto-sesion';
import { paneles } from '@/features/acceso/destinos';
import { paginasPrivadas } from './pages.config';
import PageNotFound from './PageNotFound';

function Navegacion() {
  const { estado, comprobar } = useSesion();

  if (estado.tipo === 'comprobando') {
    return <MarcoAcceso><p role="status">Comprobando sesión…</p></MarcoAcceso>;
  }
  if (estado.tipo === 'error') {
    return (
      <MarcoAcceso>
        <h1 className="font-heading text-2xl font-semibold">Acceso no disponible</h1>
        <p role="alert" className="mt-3 text-sm text-muted-foreground">{estado.mensaje}</p>
        <Button className="mt-5 min-h-11" onClick={comprobar}>Volver a intentar</Button>
      </MarcoAcceso>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/Home" element={<Navigate to="/" replace />} />
      {paginasPrivadas.map(({ ruta, rol, Pantalla }) => (
        <Route key={ruta} path={ruta} element={
          estado.tipo === 'autenticado' && estado.identidad.roles.includes(rol)
            ? <Pantalla key={estado.identidad.id} identidad={estado.identidad} />
            : <Navigate to={estado.tipo === 'autenticado' && estado.identidad.roles.length === 1
              ? paneles[estado.identidad.roles[0]].ruta : '/'} replace />
        } />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <BrowserRouter>
        <ProveedorSesion>
          <Routes>
            <Route path="/recuperar-contrasena" element={<Recuperacion key="solicitar" modo="solicitar" />} />
            <Route path="/restablecer-contrasena" element={<Recuperacion key="restablecer" modo="restablecer" />} />
            <Route path="/activar-institucion" element={<ActivacionInstitucion />} />
            {vistasRegistro.map(vista => (
              <Route key={vista.ruta} path={vista.ruta} element={<RegistroVistaPrevia key={vista.ruta} vista={vista} />} />
            ))}
            <Route path="*" element={<Navegacion />} />
          </Routes>
        </ProveedorSesion>
      </BrowserRouter>
      <Toaster />
      <VisualEditAgent />
    </QueryClientProvider>
  );
}
