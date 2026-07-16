"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { DIAS_SEMANA, DiaSemana, Settings } from "@/config/settings";

type Janelas = Partial<Record<DiaSemana, [string, string][]>>;

export default function PainelPage() {
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    null
  );

  useEffect(() => {
    if (!session?.user) return;
    setCarregando(true);
    fetch("/api/settings")
      .then(async (r) => {
        if (r.status === 403) {
          setSemPermissao(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
      })
      .catch(() => setMsg({ tipo: "erro", texto: "Falha ao carregar." }))
      .finally(() => setCarregando(false));
  }, [session?.user]);

  function atualizarCampo<K extends keyof Settings>(campo: K, valor: Settings[K]) {
    setSettings((s) => (s ? { ...s, [campo]: valor } : s));
  }

  function atualizarJanelas(janelas: Janelas) {
    setSettings((s) => (s ? { ...s, janelas } : s));
  }

  function addJanela(dia: DiaSemana) {
    if (!settings) return;
    const j: Janelas = { ...settings.janelas };
    j[dia] = [...(j[dia] ?? []), ["09:00", "12:00"]];
    atualizarJanelas(j);
  }

  function removerJanela(dia: DiaSemana, idx: number) {
    if (!settings) return;
    const j: Janelas = { ...settings.janelas };
    const lista = [...(j[dia] ?? [])];
    lista.splice(idx, 1);
    if (lista.length > 0) j[dia] = lista;
    else delete j[dia];
    atualizarJanelas(j);
  }

  function editarJanela(
    dia: DiaSemana,
    idx: number,
    pos: 0 | 1,
    valor: string
  ) {
    if (!settings) return;
    const j: Janelas = { ...settings.janelas };
    const lista = (j[dia] ?? []).map(
      (par, i) =>
        (i === idx
          ? pos === 0
            ? [valor, par[1]]
            : [par[0], valor]
          : par) as [string, string]
    );
    j[dia] = lista;
    atualizarJanelas(j);
  }

  async function salvar() {
    if (!settings) return;
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "erro", texto: data.error || "Erro ao salvar." });
      } else {
        setSettings(data.settings);
        setMsg({ tipo: "ok", texto: "Configurações salvas! ✅" });
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Erro ao salvar. Tente novamente." });
    } finally {
      setSalvando(false);
    }
  }

  // ----- Telas -----

  if (status === "loading") {
    return (
      <Frame>
        <div className="card">
          <p className="loading">Carregando…</p>
        </div>
      </Frame>
    );
  }

  if (!session?.user) {
    return (
      <Frame>
        <div className="card">
          <h2>Painel da concierge</h2>
          <p className="hint">Entre com sua conta Google para acessar.</p>
          <button className="btn-google" onClick={() => signIn("google")}>
            Entrar com Google
          </button>
        </div>
      </Frame>
    );
  }

  if (semPermissao) {
    return (
      <Frame>
        <div className="card">
          <h2>Sem permissão</h2>
          <p className="hint">
            A conta <strong>{session.user.email}</strong> não tem acesso ao
            painel. Peça para adicionar este e-mail em <code>ADMIN_EMAILS</code>.
          </p>
          <button className="btn-ghost" onClick={() => signOut()}>
            Sair
          </button>
        </div>
      </Frame>
    );
  }

  if (carregando || !settings) {
    return (
      <Frame>
        <div className="card">
          <p className="loading">Carregando configurações…</p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="userchip">
          <span>{session.user.email}</span>
        </div>
        <div className="spacer" />
        <button
          className="back"
          style={{ margin: 0 }}
          onClick={() => signOut()}
        >
          Sair
        </button>
      </div>

      <div className="card">
        <h2>Horários de atendimento</h2>
        <p className="hint">
          Defina as janelas de cada dia. O horário de almoço é simplesmente o
          espaço entre uma janela e outra.
        </p>

        {DIAS_SEMANA.map(({ valor, nome }) => (
          <div key={valor} className="dia-bloco">
            <div className="dia-cab">
              <strong>{nome}</strong>
              <button className="btn-mini" onClick={() => addJanela(valor)}>
                + janela
              </button>
            </div>
            {(settings.janelas[valor] ?? []).length === 0 ? (
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Sem atendimento.
              </p>
            ) : (
              (settings.janelas[valor] ?? []).map((par, idx) => (
                <div key={idx} className="janela-linha">
                  <input
                    type="time"
                    value={par[0]}
                    onChange={(e) =>
                      editarJanela(valor, idx, 0, e.target.value)
                    }
                  />
                  <span className="ate">até</span>
                  <input
                    type="time"
                    value={par[1]}
                    onChange={(e) =>
                      editarJanela(valor, idx, 1, e.target.value)
                    }
                  />
                  <button
                    className="btn-remover"
                    onClick={() => removerJanela(valor, idx)}
                    aria-label="Remover janela"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Regras das sessões</h2>
        <div className="campos">
          <div>
            <label className="field">Duração da sessão (minutos)</label>
            <input
              type="number"
              min={5}
              max={480}
              value={settings.sessionMinutes}
              onChange={(e) =>
                atualizarCampo("sessionMinutes", Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="field">Folga entre sessões (minutos)</label>
            <input
              type="number"
              min={0}
              max={240}
              value={settings.bufferMinutes}
              onChange={(e) =>
                atualizarCampo("bufferMinutes", Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="field">Antecedência mínima (horas)</label>
            <input
              type="number"
              min={0}
              max={720}
              value={settings.minNoticeHours}
              onChange={(e) =>
                atualizarCampo("minNoticeHours", Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="field">Dias com vaga a mostrar</label>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.diasComVaga}
              onChange={(e) =>
                atualizarCampo("diasComVaga", Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="field">Mostrar até (dias à frente)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.horizonDays}
              onChange={(e) =>
                atualizarCampo("horizonDays", Number(e.target.value))
              }
            />
          </div>
        </div>
      </div>

      {msg && (
        <div className={`msg ${msg.tipo === "ok" ? "msg-ok" : "msg-error"}`}>
          {msg.texto}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn-primary" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
      <p className="muted center" style={{ marginTop: 12 }}>
        As mudanças valem para novos agendamentos a partir de agora.
      </p>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="wrap">
      <div className="brand">
        <div className="eyebrow">Painel da concierge</div>
        <h1>Cúpula</h1>
        <p>Configuração da agenda</p>
      </div>
      {children}
    </main>
  );
}
