import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ORZ Funding',
  description: 'Portal de cuentas de reto ORZ Funding',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="bar">
          <a href="https://orzfunding.com">
            <img className="logo" src="https://orzfunding.com/cdn/shop/t/1/assets/logo-wide.png" alt="ORZ Funding, By Capital Ordoñez" />
          </a>
          <a href="https://orzfunding.com" className="text-sm">Tienda</a>
        </header>
        <main>{children}</main>
        <footer className="foot">El capital es simulado. Lo que se paga en dinero real es la ganancia elegible.</footer>
      </body>
    </html>
  );
}
