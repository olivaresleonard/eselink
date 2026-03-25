import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { QueryProvider } from '../lib/query-provider';
import './globals.css';
import 'leaflet/dist/leaflet.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'EseLink',
  description: 'Centro de control omnicanal para ecommerce moderno',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
