import { DateTime } from "luxon";
import { getSettings } from "@/lib/settingsStore";
import { getBusyPeriods } from "@/lib/google";
import {
  Slot,
  slotsCandidatos,
  colideComOcupado,
  diasComAtendimento as diasPuro,
} from "@/lib/schedule";

export type { Slot } from "@/lib/schedule";

/**
 * Horários disponíveis de UM dia, já descontando:
 *  - horários fora das janelas de atendimento;
 *  - horários já ocupados na agenda da concierge;
 *  - horários que não respeitam a antecedência mínima.
 */
export async function horariosDisponiveis(dataISO: string): Promise<Slot[]> {
  const s = await getSettings();
  const tz = s.timezone;
  const dia = DateTime.fromISO(dataISO, { zone: tz }).startOf("day");
  if (!dia.isValid) return [];

  const agora = DateTime.now().setZone(tz);
  const limiteAntecedencia = agora.plus({ hours: s.minNoticeHours });
  const limiteMaximo =
    s.maxNoticeHours && s.maxNoticeHours > 0
      ? agora.plus({ hours: s.maxNoticeHours })
      : null;

  const candidatos = slotsCandidatos(dia, s).filter((slot) => {
    const inicio = DateTime.fromISO(slot.inicioISO);
    if (inicio < limiteAntecedencia) return false;
    if (limiteMaximo && inicio > limiteMaximo) return false;
    return true;
  });
  if (candidatos.length === 0) return [];

  const ocupados = await getBusyPeriods(
    dia.startOf("day").toISO()!,
    dia.endOf("day").toISO()!
  );

  return candidatos.filter((slot) => !colideComOcupado(slot, ocupados));
}

/** Lista os dias com atendimento, com base nas configurações efetivas. */
export async function diasComAtendimento() {
  const s = await getSettings();
  return diasPuro(s);
}

/** Confere, no momento da marcação, se um horário exato ainda está livre. */
export async function slotAindaDisponivel(inicioISO: string): Promise<Slot | null> {
  const s = await getSettings();
  const inicio = DateTime.fromISO(inicioISO).setZone(s.timezone);
  if (!inicio.isValid) return null;

  const disponiveis = await horariosDisponiveis(inicio.toISODate()!);
  return (
    disponiveis.find(
      (slot) => DateTime.fromISO(slot.inicioISO).toMillis() === inicio.toMillis()
    ) ?? null
  );
}
