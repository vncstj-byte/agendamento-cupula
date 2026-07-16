"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

interface Slot {
  inicioISO: string;
  fimISO: string;
  label: string;
}

interface Dia {
  dataISO: string;
  label: string;
}

interface Confirmacao {
  meetLink?: string;
  htmlLink: string;
  dataLegivel: string;
}

interface Agendamento {
  id: string;
  meetLink?: string;
  dataLegivel: string;
}

export default function AgendarPage() {
  const { data: session, status } = useSession();

  const [dias, setDias] = useState<Dia[]>([]);
  const [carregandoDias, setCarregandoDias] = useState(true);
  const [diaSel, setDiaSel] = useState<Dia | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotSel, setSlotSel] = useState<Slot | null>(null);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [jaAgendado, setJaAgendado] = useState<Agendamento | null>(null);
  const [carregandoAgendamento, setCarregandoAgendamento] = useState(true);
  const [reagendarMode, setReagendarMode] = useState(false);

  // Carrega os próximos dias com vaga a partir das configurações atuais.
  useEffect(() => {
    if (!session?.user) return;
    setCarregandoDias(true);
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setDias(data.dias || []);
        if (data.sessionMinutes) setSessionMinutes(data.sessionMinutes);
      })
      .catch(() => setDias([]))
      .finally(() => setCarregandoDias(false));
  }, [session?.user]);

  // Verifica se o mentorado já tem um onboarding marcado.
  useEffect(() => {
    if (!session?.user) return;
    setCarregandoAgendamento(true);
    fetch("/api/meu-agendamento")
      .then((r) => r.json())
      .then((data) => setJaAgendado(data.agendamento || null))
      .catch(() => setJaAgendado(null))
      .finally(() => setCarregandoAgendamento(false));
  }, [session?.user]);

  function irReagendar() {
    setReagendarMode(true);
    setConfirmacao(null);
    setDiaSel(null);
    setSlotSel(null);
    setObservacao("");
    setErro(null);
  }

  useEffect(() => {
    if (!diaSel) return;
    setSlotSel(null);
    setSlots([]);
    setErro(null);
    setCarregandoSlots(true);
    fetch(`/api/slots?date=${diaSel.dataISO}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setErro(data.error);
        else setSlots(data.slots || []);
      })
      .catch(() => setErro("Não foi possível carregar os horários."))
      .finally(() => setCarregandoSlots(false));
  }, [diaSel]);

  async function confirmar() {
    if (!slotSel) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: slotSel.inicioISO,
          observacao,
          reagendar: reagendarMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível concluir o agendamento.");
        // Se o horário sumiu, recarrega a lista do dia.
        if (res.status === 409 && data.jaAgendado) {
          // Já existe um onboarding — muda para o modo reagendar.
          setReagendarMode(true);
        } else if (res.status === 409 && diaSel) {
          setSlotSel(null);
          fetch(`/api/slots?date=${diaSel.dataISO}`)
            .then((r) => r.json())
            .then((d) => setSlots(d.slots || []));
        }
      } else {
        setConfirmacao({
          meetLink: data.evento.meetLink,
          htmlLink: data.evento.htmlLink,
          dataLegivel: data.evento.dataLegivel,
        });
        setJaAgendado({
          id: data.evento.id,
          meetLink: data.evento.meetLink,
          dataLegivel: data.evento.dataLegivel,
        });
        setReagendarMode(false);
      }
    } catch {
      setErro("Não foi possível concluir o agendamento.");
    } finally {
      setEnviando(false);
    }
  }

  // ----- Estados de tela -----

  if (status === "loading") {
    return (
      <main className="wrap">
        <Brand />
        <div className="card">
          <p className="loading">Carregando…</p>
        </div>
      </main>
    );
  }

  // Não logado → pedir login
  if (!session?.user) {
    return (
      <main className="wrap">
        <Brand />
        <div className="card">
          <h2>Entre para agendar</h2>
          <p className="hint">
            Use sua conta Google para se identificar. Só pedimos seu nome e
            e-mail — nada da sua agenda pessoal.
          </p>
          <button className="btn-google" onClick={() => signIn("google")}>
            <GoogleIcon /> Entrar com Google
          </button>
        </div>
      </main>
    );
  }

  // Confirmado → tela final
  if (confirmacao) {
    return (
      <main className="wrap">
        <Brand />
        <div className="card">
          <div className="step-label">Agendamento confirmado</div>
          <h2>Tudo certo! ✨</h2>
          <p className="hint">
            Enviamos o convite para <strong>{session.user.email}</strong> com
            todos os detalhes.
          </p>
          <div className="confirm-box">
            <div className="line">
              <span>Quando</span>
              <span>{confirmacao.dataLegivel}</span>
            </div>
            <div className="line">
              <span>Duração</span>
              <span>{sessionMinutes} minutos de reunião</span>
            </div>
            <div className="line">
              <span>Onde</span>
              <span>Google Meet (vídeo)</span>
            </div>
          </div>
          {confirmacao.meetLink && (
            <a className="big-meet" href={confirmacao.meetLink} target="_blank">
              Entrar no Google Meet
            </a>
          )}
          <p className="muted center" style={{ marginTop: 14 }}>
            O link também está no convite enviado ao seu e-mail.
          </p>
        </div>
        <div className="center">
          <button className="btn-ghost" onClick={irReagendar}>
            Remarcar
          </button>
        </div>
      </main>
    );
  }

  // Já tem onboarding e não está reagendando → oferecer reagendar
  if (carregandoAgendamento && !reagendarMode) {
    return (
      <main className="wrap">
        <Brand />
        <div className="card">
          <p className="loading">Carregando…</p>
        </div>
      </main>
    );
  }

  if (jaAgendado && !reagendarMode) {
    return (
      <main className="wrap">
        <Brand />
        <UserChip session={session} />
        <div className="card">
          <div className="step-label">Seu onboarding</div>
          <h2>Você já tem um onboarding marcado 🎉</h2>
          <div className="confirm-box" style={{ marginTop: 16 }}>
            <div className="line">
              <span>Quando</span>
              <span>{jaAgendado.dataLegivel}</span>
            </div>
            <div className="line">
              <span>Duração</span>
              <span>{sessionMinutes} minutos de reunião</span>
            </div>
            <div className="line">
              <span>Onde</span>
              <span>Google Meet (vídeo)</span>
            </div>
          </div>
          {jaAgendado.meetLink && (
            <a className="big-meet" href={jaAgendado.meetLink} target="_blank">
              Entrar no Google Meet
            </a>
          )}
          <p className="muted center" style={{ marginTop: 14 }}>
            Precisa de outro horário? É só remarcar — o horário atual é
            cancelado automaticamente.
          </p>
        </div>
        <div className="center">
          <button className="btn-ghost" onClick={irReagendar}>
            Remarcar
          </button>
        </div>
      </main>
    );
  }

  // Escolheu um horário → confirmação
  if (slotSel && diaSel) {
    return (
      <main className="wrap">
        <Brand />
        <UserChip session={session} />
        <div className="card">
          <button className="back" onClick={() => setSlotSel(null)}>
            ← Voltar aos horários
          </button>
          <div className="step-label">
            {reagendarMode ? "Remarcar" : "Confirmar"}
          </div>
          <h2>Revise e confirme</h2>
          {reagendarMode && (
            <p className="hint">
              Ao confirmar, seu horário anterior é cancelado automaticamente.
            </p>
          )}
          <div className="confirm-box" style={{ marginTop: 16 }}>
            <div className="line">
              <span>Dia</span>
              <span style={{ textTransform: "capitalize" }}>
                {diaSel.label}
              </span>
            </div>
            <div className="line">
              <span>Horário</span>
              <span>{slotSel.label}</span>
            </div>
            <div className="line">
              <span>Duração</span>
              <span>{sessionMinutes} minutos</span>
            </div>
          </div>
          <label className="field" htmlFor="obs">
            Quer deixar algum recado para a concierge? (opcional)
          </label>
          <textarea
            id="obs"
            rows={3}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: gostaria de falar sobre…"
          />
          {erro && <div className="msg msg-error">{erro}</div>}
          <div style={{ marginTop: 18 }}>
            <button
              className="btn-primary"
              disabled={enviando}
              onClick={confirmar}
            >
              {enviando
                ? "Confirmando…"
                : reagendarMode
                ? "Confirmar remarcação"
                : "Confirmar agendamento"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Escolheu um dia → mostrar horários
  if (diaSel) {
    return (
      <main className="wrap">
        <Brand />
        <UserChip session={session} />
        <div className="card">
          <button className="back" onClick={() => setDiaSel(null)}>
            ← Voltar aos dias
          </button>
          <div className="step-label">Passo 2 de 2</div>
          <h2 style={{ textTransform: "capitalize" }}>{diaSel.label}</h2>
          <p className="hint">Escolha um horário disponível.</p>
          {carregandoSlots && <p className="loading">Buscando horários…</p>}
          {erro && <div className="msg msg-error">{erro}</div>}
          {!carregandoSlots && !erro && slots.length === 0 && (
            <p className="muted">
              Nenhum horário disponível neste dia. Tente outro.
            </p>
          )}
          {slots.length > 0 && (
            <div className="grid grid-slots">
              {slots.map((s) => (
                <button
                  key={s.inicioISO}
                  className="pill slot"
                  onClick={() => {
                    setErro(null);
                    setSlotSel(s);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Passo inicial → escolher dia
  return (
    <main className="wrap">
      <Brand />
      <UserChip session={session} />
      <div className="card">
        {reagendarMode && jaAgendado && (
          <button className="back" onClick={() => setReagendarMode(false)}>
            ← Cancelar remarcação
          </button>
        )}
        <div className="step-label">
          {reagendarMode ? "Remarcar · Passo 1 de 2" : "Passo 1 de 2"}
        </div>
        <h2>Escolha o dia</h2>
        <p className="hint">Estes são os próximos dias com atendimento.</p>
        {carregandoDias ? (
          <p className="loading">Carregando dias…</p>
        ) : dias.length === 0 ? (
          <p className="muted">
            Nenhum dia de atendimento configurado no momento.
          </p>
        ) : (
          <div className="grid grid-days">
            {dias.map((d) => (
              <button
                key={d.dataISO}
                className="pill"
                style={{ textTransform: "capitalize" }}
                onClick={() => setDiaSel(d)}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ----- Componentes auxiliares -----

function Brand() {
  return (
    <div className="brand">
      <div className="eyebrow">Programa de mentoria para advogados</div>
      <h1>Cúpula</h1>
      <p>
        É um prazer te receber na Cúpula!
        <br />
        Agende seu onboarding com nossa concierge:
      </p>
    </div>
  );
}

function UserChip({ session }: { session: { user?: { name?: string | null; email?: string | null; image?: string | null } } }) {
  const user = session.user;
  return (
    <div className="row" style={{ marginBottom: 16 }}>
      <div className="userchip">
        {user?.image && <img src={user.image} alt="" />}
        <span>{user?.name || user?.email}</span>
      </div>
      <div className="spacer" />
      <button
        className="back"
        style={{ margin: 0 }}
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sair
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
