import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cúpula — Agendamento de Onboarding",
  description:
    "Agende seu onboarding do programa de mentoria Cúpula com a concierge.",
};

/** Símbolo da marca (recriação do anel de pontos da Cúpula). */
function LogoMark() {
  const dots = [];
  for (let k = 0; k < 11; k++) {
    dots.push(
      <circle
        key={k}
        cx="14"
        cy="4.6"
        r="1.7"
        fill="#e50914"
        opacity={1 - k * 0.06}
        transform={`rotate(${k * 30} 14 14)`}
      />
    );
  }
  return (
    <svg className="logo-mark" viewBox="0 0 28 28" aria-hidden>
      {dots}
    </svg>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>
          <header className="topbar">
            <div className="topbar-inner">
              <Link href="/" className="logo">
                <LogoMark />
                <span className="logo-text">Cúpula</span>
              </Link>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
