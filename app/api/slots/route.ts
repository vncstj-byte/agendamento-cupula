import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { horariosDisponiveis } from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * GET /api/slots?date=YYYY-MM-DD
 * Retorna os horários disponíveis no dia informado.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Parâmetro 'date' inválido. Use o formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  try {
    const slots = await horariosDisponiveis(date);
    return NextResponse.json({ slots });
  } catch (e) {
    console.error("Erro ao buscar horários:", e);
    return NextResponse.json(
      { error: "Não foi possível carregar os horários. Tente novamente." },
      { status: 500 }
    );
  }
}
