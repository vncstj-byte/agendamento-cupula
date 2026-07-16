import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { getSettings, saveSettings } from "@/lib/settingsStore";

export const dynamic = "force-dynamic";

/** GET /api/settings — configurações atuais (somente para a concierge). */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdmin(email)) {
    return NextResponse.json(
      { error: "Sem permissão para o painel." },
      { status: 403 }
    );
  }

  const settings = await getSettings();
  return NextResponse.json({ settings });
}

/** POST /api/settings — salva novas configurações (somente para a concierge). */
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdmin(email)) {
    return NextResponse.json(
      { error: "Sem permissão para o painel." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  try {
    const settings = await saveSettings(body);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    console.error("Erro ao salvar configurações:", e);
    return NextResponse.json(
      { error: "Não foi possível salvar. Tente novamente." },
      { status: 500 }
    );
  }
}
