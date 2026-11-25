import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import base44 from '@base44/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath } from 'vite';

const web = fileURLToPath(new URL('.', import.meta.url));
const repositorio = fileURLToPath(new URL('../../', import.meta.url));
const base44Dist = normalizePath(dirname(createRequire(import.meta.url).resolve('@base44/vite-plugin')));

export default defineConfig({
  logLevel: 'error',
  envDir: repositorio,
  envPrefix: ['VITE_BASE44_'],
  build: {
    outDir: fileURLToPath(new URL('../../dist', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
    }),
    react(),
    {
      name: 'master-express-web',
      enforce: 'post',
      config() {
        // Base44 lee el entorno desde la raíz de npm antes de fijar la raíz web.
        return {
          root: web,
          resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
        };
      },
      transformIndexHtml: {
        order: 'post',
        handler(html, { server }) {
          if (!server) return html;
          // El plugin inyecta rutas absolutas que suponían node_modules en la raíz web.
          return html.replaceAll(
            'src="/node_modules/@base44/vite-plugin/dist/',
            `src="/@fs/${base44Dist}/`,
          );
        },
      },
    },
  ],
});
