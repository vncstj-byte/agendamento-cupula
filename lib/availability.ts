import { DateTime, Interval } from "luxon";
import { settings } from "@/config/settings";
import { getBusyPeriods, BusyPeriod } from "@/lib/google";

export { diasComAtendimento } from "@/lib/dias";

export interface Slot {
  /** Início do horário, em ISO com fuso (ex.: 2026-07-20T09:00:00-03:00). */
  inicioISO: string;
  /** Fim do horário, em ISO com fuso. */
  fimISO: string;
  /** Rótulo amigável para exibir (ex.: "09:00"). */
  label: string;
}

/** Gera os horários candidatos de um dia, só a partir das janelas configuradas. */
function slotsCandidatos(dia: DateTime): Slot[] {
  const weekday = dia.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const janelas = settings.janelas[weekday] ?? [];
  const passo = settings.sessionMinutes + settings.bufferMinutes;
  const slots: Slot[] = [];

  for (const [inicio, fim] of janelas) {
    const [hi, mi] = inicio.split(":").map(Number);
    const [hf, mf] = fim.split(":").map(Number);

    let cursor = dia.set({ hour: hi, minute: mi, second: 0, millisecond: 0 });
    const limite = dia.set({ hour: hf, minute: mf, second: 0, millisecond: 0 });

    while (true) {
      const slotFim = cursor.plus({ minutes: settings.sessionMinutes });
      if (slotFim > limite) break;

      slots.push({
        inicioISO: cursor.toISO()!,
        fimISO: slotFim.toISO()!,
        label: cursor.toFormat("HH:mm"),
      });

      cursor = cursor.plus({ minutes: passo });
    }
  }

  return slots;
}

/** Verifica se um slot colide com algum período ocupado da agenda. */
function colideComOcupado(slot: Slot, ocupados: BusyPeriod[]): boolean {
  const slotIntervalo = Interval.fromDateTimes(
    DateTime.fromISO(slot.inicioISO),
    DateTime.fromISO(slot.fimISO)
  );
  return ocupados.some((b) => {
    const ocupado = Interval.fromDateTimes(
      DateTime.fromISO(b.start),
      DateTime.fromISO(b.end)
    );
    return slotIntervalo.overlaps(ocupado);
  });
}

/**
 * Retorna os horários disponíveis de UM dia específico, já descontando:
 *  - horários fora das janelas de atendimento;
 *  - horários que já têm compromisso na agenda da concierge;
 *  - horários que não respeitam a antecedência mínima.
 *
 * @param dataISO Data no formato YYYY-MM-DD.
 */
export async function horariosDisponiveis(dataISO: string): Promise<Slot[]> {
  const tz = settings.timezone;
  const dia = DateTime.fromISO(dataISO, { zone: tz }).startOf("day");
  if (!dia.isValid) return [];

  const agora = DateTime.now().setZone(tz);
  const limiteAntecedencia = agora.plus({ hours: settings.minNoticeHours });

  const candidatos = slotsCandidatos(dia).filter(
    (s) => DateTime.fromISO(s.inicioISO) >= limiteAntecedencia
  );
  if (candidatos.length === 0) return [];

  const ocupados = await getBusyPeriods(
    dia.startOf("day").toISO()!,
    dia.endOf("day").toISO()!
  );

  return candidatos.filter((s) => !colideComOcupado(s, ocupados));
}

/** Confere, no momento da marcação, se um horário exato ainda está livre. */
export async function slotAindaDisponivel(inicioISO: string): Promise<Slot | null> {
  const tz = settings.timezone;
  const inicio = DateTime.fromISO(inicioISO).setZone(tz);
  if (!inicio.isValid) return null;

  const disponiveis = await horariosDisponiveis(inicio.toISODate()!);
  return (
    disponiveis.find(
      (s) => DateTime.fromISO(s.inicioISO).toMillis() === inicio.toMillis()
    ) ?? null
  );
}
