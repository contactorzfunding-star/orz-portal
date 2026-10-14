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
            <img className="logo" src="https://cdn.shopify.com/s/files/1/1035/4262/0454/files/logo-wide.png?v=1791554420" alt="ORZ Funding, By Capital Ordoñez" />
          </a>
          <a href="https://orzfunding.com">Tienda</a>
        </header>
        <main>{children}</main>
        <footer className="foot">El capital es simulado. Lo que se paga en dinero real es la ganancia elegible.</footer>
      </body>
    </html>
  );
}
