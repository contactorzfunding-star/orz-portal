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
          <a className="brand" href="https://orzfunding.com">
            <b>ORZ</b>
            <small>Funding · By Capital Ordoñez</small>
          </a>
          <a href="https://orzfunding.com">Tienda</a>
        </header>
        <main>{children}</main>
        <footer className="foot">El capital es simulado. Lo que se paga en dinero real es la ganancia elegible.</footer>
      </body>
    </html>
  );
}
