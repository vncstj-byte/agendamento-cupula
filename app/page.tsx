import Link from "next/link";

export default function Home() {
  return (
    <main className="wrap">
      <div className="brand">
        <div className="eyebrow">Programa de mentoria para advogados</div>
        <h1>Cúpula</h1>
        <p>Agende seu onboarding com nossa concierge.</p>
      </div>

      <div className="card">
        <h2>Como funciona</h2>
        <p className="hint">Em poucos passos você garante seu horário.</p>
        <ol style={{ color: "var(--text-dim)", paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 8 }}>Entre com sua conta Google.</li>
          <li style={{ marginBottom: 8 }}>
            Escolha um dia e um horário disponível na agenda.
          </li>
          <li style={{ marginBottom: 8 }}>
            Pronto! Você recebe o convite com o link do Google Meet por e-mail.
          </li>
        </ol>
        <div style={{ marginTop: 24 }}>
          <Link href="/agendar" className="btn btn-primary">
            Agendar meu onboarding
          </Link>
        </div>
      </div>

      <p className="center muted">
        Programa Cúpula · atendimento realizado por vídeo (Google Meet)
      </p>
      <p className="center muted" style={{ marginTop: 8 }}>
        <Link href="/painel" style={{ color: "var(--text-dim)" }}>
          Área da concierge
        </Link>
      </p>
    </main>
  );
}
