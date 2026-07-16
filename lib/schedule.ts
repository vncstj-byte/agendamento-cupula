import { DateTime, Interval } from "luxon";
import { Settings, DiaSemana } from "@/config/settings";

export interface Slot {
  inicioISO: string;
  fimISO: string;
  label: string;
}

export interface BusyPeriod {
  start: string;
  end: string;
}

/** Gera os horários candidatos de um dia, a partir das janelas configuradas. */
export function slotsCandidatos(dia: DateTime, s: Settings): Slot[] {
  const weekday = dia.weekday as DiaSemana;
  const janelas = s.janelas[weekday] ?? [];
  const passo = s.sessionMinutes + s.bufferMinutes;
  const slots: Slot[] = [];

  for (const [inicio, fim] of janelas) {
    const [hi, mi] = inicio.split(":").map(Number);
    const [hf, mf] = fim.split(":").map(Number);

    let cursor = dia.set({ hour: hi, minute: mi, second: 0, millisecond: 0 });
    const limite = dia.set({ hour: hf, minute: mf, second: 0, millisecond: 0 });

    while (true) {
      const slotFim = cursor.plus({ minutes: s.sessionMinutes });
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
export function colideComOcupado(slot: Slot, ocupados: BusyPeriod[]): boolean {
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
