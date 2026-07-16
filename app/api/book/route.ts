import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { PROGRAMA } from "@/config/settings";
import { getSettings } from "@/lib/settingsStore";
import { slotAindaDisponivel } from "@/lib/availability";
import { criarEvento } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * POST /api/book
 * Corpo: { start: "2026-07-20T09:00:00-03:00", observacao?: string }
 * Cria o evento da mentoria na agenda da concierge.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  const nome = session?.user?.name || "Mentorado";

  if (!email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Restrição opcional a uma lista de e-mails autorizados.
  const autorizados = env.allowedEmails();
  if (autorizados.length > 0 && !autorizados.includes(email)) {
    return NextResponse.json(
      { error: "Este e-mail não está autorizado a marcar mentorias." },
      { status: 403 }
    );
  }

  let body: { start?: string; observacao?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const start = body.start;
  if (!start) {
    return NextResponse.json(
      { error: "Horário (start) é obrigatório." },
      { status: 400 }
    );
  }

  try {
    // Reconfere que o horário continua livre (evita marcação duplicada).
    const slot = await slotAindaDisponivel(start);
    if (!slot) {
      return NextResponse.json(
        {
          error:
            "Esse horário acabou de ficar indisponível. Escolha outro, por favor.",
        },
        { status: 409 }
      );
    }

    const settings = await getSettings();
    const inicio = DateTime.fromISO(slot.inicioISO).setZone(settings.timezone);
    const dataLegivel = inicio
      .setLocale("pt-BR")
      .toFormat("cccc, dd 'de' LLLL 'às' HH:mm");

    const observacao = (body.observacao || "").trim();
    const descricao = [
      `Sessão de mentoria do programa ${PROGRAMA}.`,
      ``,
      `Mentorado: ${nome} (${email})`,
      observacao ? `\nObservação do mentorado:\n${observacao}` : "",
    ].join("\n");

    const evento = await criarEvento({
      inicioISO: slot.inicioISO,
      fimISO: slot.fimISO,
      timezone: settings.timezone,
      menteeNome: nome,
      menteeEmail: email,
      cupulaEmail: env.cupulaEmail(),
      titulo: `Mentoria ${PROGRAMA} — ${nome}`,
      descricao,
    });

    return NextResponse.json({
      ok: true,
      evento: {
        id: evento.id,
        meetLink: evento.meetLink,
        htmlLink: evento.htmlLink,
        inicioISO: evento.inicioISO,
        dataLegivel,
      },
    });
  } catch (e) {
    console.error("Erro ao criar agendamento:", e);
    return NextResponse.json(
      { error: "Não foi possível concluir o agendamento. Tente novamente." },
      { status: 500 }
    );
  }
}
