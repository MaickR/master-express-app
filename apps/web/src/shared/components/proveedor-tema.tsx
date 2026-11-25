import type { PropsWithChildren } from 'react';
import { ThemeProvider } from 'next-themes';

export default function ProveedorTema({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" storageKey="theme" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
