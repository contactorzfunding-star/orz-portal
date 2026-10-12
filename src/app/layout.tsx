import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORZ Funding - Mi Cuenta",
  description: "Portal de cuentas de reto ORZ Funding",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-black text-white font-sans antialiased">
        <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black font-bold flex items-center justify-center text-sm">ORZ</div>
            <span className="font-semibold tracking-wide">ORZ Funding</span>
          </div>
          <a
            href="https://orzfunding.com"
            className="text-sm text-white/70 hover:text-white underline"
          >
            Volver a la tienda
          </a>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 px-4 py-3 text-center text-xs text-white/50">
          El capital es simulado. Lo que se paga en dinero real es la ganancia elegible.
        </footer>
      </body>
    </html>
  );
}