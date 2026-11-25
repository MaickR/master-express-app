import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import '@/app/index.css'

const raiz = document.getElementById('root')
if (!raiz) {
  throw new Error('Falta el elemento raíz de MasterExpress Control.')
}

createRoot(raiz).render(<App />)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



