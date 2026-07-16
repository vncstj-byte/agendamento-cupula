import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settingsStore";
import { buscarOnboardingDoMentee } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * GET /api/meu-agendamento
 * Retorna o onboarding futuro do mentorado logado (se houver).
 */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const s = await getSettings();
    const agora = DateTime.now().setZone(s.timezone);
    const existente = await buscarOnboardingDoMentee(email, agora.toISO()!);

    if (!existente) {
      return NextResponse.json({ agendamento: null });
    }

    const inicio = DateTime.fromISO(existente.inicioISO).setZone(s.timezone);
    return NextResponse.json({
      agendamento: {
        id: existente.id,
        meetLink: existente.meetLink,
        dataLegivel: inicio
          .setLocale("pt-BR")
          .toFormat("cccc, dd 'de' LLLL 'às' HH:mm"),
      },
    });
  } catch (e) {
    console.error("Erro ao buscar agendamento do mentorado:", e);
    return NextResponse.json({ agendamento: null });
  }
}
