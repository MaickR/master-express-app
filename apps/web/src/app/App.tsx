import './App.css'
import { Toaster } from "@/shared/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/shared/lib/query-client'
import VisualEditAgent from '@/integrations/base44/VisualEditAgent'
import NavigationTracker from '@/integrations/base44/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './PageNotFound';
import { AuthProvider, useAuth } from '@/integrations/base44/AuthContext';
import UserNotRegisteredError from '@/shared/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const MainPage = Pages[mainPage];

type PropsLayout = Parameters<typeof Layout>[0];

// * Contrato que consume el router del contexto de Base44 en JSX.
type EstadoAcceso = {
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: { type: string } | null;
  navigateToLogin: () => void;
};

const LayoutWrapper = ({ children, currentPageName }: PropsLayout) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin }: EstadoAcceso = useAuth();

  // La navegación espera la configuración pública y el estado de sesión.
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
