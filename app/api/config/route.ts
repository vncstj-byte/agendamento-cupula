import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settingsStore";
import { proximosDiasComVaga } from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * GET /api/config
 * Informações públicas (para o mentorado logado) necessárias na tela
 * de agendamento: próximos dias com vaga, duração da sessão e fuso.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const s = await getSettings();
  const dias = await proximosDiasComVaga();
  return NextResponse.json({
    dias,
    sessionMinutes: s.sessionMinutes,
    timezone: s.timezone,
  });
}
