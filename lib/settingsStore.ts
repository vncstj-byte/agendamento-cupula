import { defaultSettings, Settings, DiaSemana } from "@/config/settings";
import { lerConfigEvento, gravarConfigEvento } from "@/lib/google";

/**
 * Camada de configurações efetivas do sistema.
 *
 * getSettings() devolve o que a concierge salvou no painel (guardado
 * na agenda); se nada foi salvo ainda, cai nos padrões de config/settings.ts.
 * Um cache curto evita consultar a agenda a cada requisição.
 */

let cache: { value: Settings; at: number } | null = null;
const CACHE_MS = 30_000;

function agora(): number {
  return Date.now();
}

/** Junta o que veio salvo por cima dos padrões e valida o resultado. */
function normalizar(parcial: unknown): Settings {
  const base: Settings = JSON.parse(JSON.stringify(defaultSettings));
  if (!parcial || typeof parcial !== "object") return base;

  const p = parcial as Partial<Settings>;
  const out: Settings = {
    timezone:
      typeof p.timezone === "string" && p.timezone ? p.timezone : base.timezone,
    sessionMinutes: clampInt(p.sessionMinutes, 5, 480, base.sessionMinutes),
    bufferMinutes: clampInt(p.bufferMinutes, 0, 240, base.bufferMinutes),
    minNoticeHours: clampInt(p.minNoticeHours, 0, 720, base.minNoticeHours),
    maxNoticeHours: clampInt(p.maxNoticeHours, 0, 8760, base.maxNoticeHours),
    horizonDays: clampInt(p.horizonDays, 1, 365, base.horizonDays),
    janelas: normalizarJanelas(p.janelas) ?? base.janelas,
  };
  return out;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizarJanelas(
  j: unknown
): Partial<Record<DiaSemana, [string, string][]>> | null {
  if (!j || typeof j !== "object") return null;
  const out: Partial<Record<DiaSemana, [string, string][]>> = {};
  for (const dia of [1, 2, 3, 4, 5, 6, 7] as DiaSemana[]) {
    const lista = (j as Record<number, unknown>)[dia];
    if (!Array.isArray(lista)) continue;
    const validas: [string, string][] = [];
    for (const par of lista) {
      if (
        Array.isArray(par) &&
        par.length === 2 &&
        RE_HORA.test(par[0]) &&
        RE_HORA.test(par[1]) &&
        par[0] < par[1]
      ) {
        validas.push([par[0], par[1]]);
      }
    }
    if (validas.length > 0) out[dia] = validas;
  }
  return out;
}

/** Configurações efetivas (do painel ou dos padrões), com cache curto. */
export async function getSettings(): Promise<Settings> {
  if (cache && agora() - cache.at < CACHE_MS) return cache.value;

  let value: Settings = defaultSettings;
  try {
    const json = await lerConfigEvento();
    if (json) value = normalizar(JSON.parse(json));
  } catch (e) {
    console.error("Falha ao ler configurações da agenda; usando padrões.", e);
    value = defaultSettings;
  }

  cache = { value, at: agora() };
  return value;
}

/** Salva novas configurações no painel (grava na agenda) e limpa o cache. */
export async function saveSettings(parcial: unknown): Promise<Settings> {
  const normalizado = normalizar(parcial);
  await gravarConfigEvento(JSON.stringify(normalizado));
  cache = { value: normalizado, at: agora() };
  return normalizado;
}
