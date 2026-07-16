import { DateTime } from "luxon";
import { DiaSemana } from "@/config/settings";
import { getSettings } from "@/lib/settingsStore";
import { getBusyPeriods } from "@/lib/google";
import { Slot, slotsCandidatos, colideComOcupado } from "@/lib/schedule";

export type { Slot } from "@/lib/schedule";

export interface DiaComVaga {
  dataISO: string;
  label: string;
}

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

  const candidatos = slotsCandidatos(dia, s).filter(
    (slot) => DateTime.fromISO(slot.inicioISO) >= limiteAntecedencia
  );
  if (candidatos.length === 0) return [];

  const ocupados = await getBusyPeriods(
    dia.startOf("day").toISO()!,
    dia.endOf("day").toISO()!
  );

  return candidatos.filter((slot) => !colideComOcupado(slot, ocupados));
}

/**
 * Retorna os próximos dias que REALMENTE têm horário livre, na
 * quantidade configurada (settings.diasComVaga). Se um dia estiver
 * lotado ou já tiver passado, ele é pulado e o próximo dia com vaga
 * entra no lugar — assim a lista nunca mostra um dia vazio.
 *
 * Faz uma única consulta de ocupação para toda a janela de busca.
 */
export async function proximosDiasComVaga(): Promise<DiaComVaga[]> {
  const s = await getSettings();
  const tz = s.timezone;
  const agora = DateTime.now().setZone(tz);
  const limiteAntecedencia = agora.plus({ hours: s.minNoticeHours });
  const alvo = Math.max(1, s.diasComVaga);

  const inicio = agora.startOf("day");
  const fim = inicio.plus({ days: s.horizonDays }).endOf("day");
  const ocupados = await getBusyPeriods(inicio.toISO()!, fim.toISO()!);

  const dias: DiaComVaga[] = [];
  for (let i = 0; i <= s.horizonDays; i++) {
    const dia = inicio.plus({ days: i });
    const weekday = dia.weekday as DiaSemana;
    const janelas = s.janelas[weekday] ?? [];
    if (janelas.length === 0) continue;

    const temVaga = slotsCandidatos(dia, s).some((slot) => {
      const ini = DateTime.fromISO(slot.inicioISO);
      return ini >= limiteAntecedencia && !colideComOcupado(slot, ocupados);
    });

    if (temVaga) {
      dias.push({
        dataISO: dia.toISODate()!,
        label: dia.setLocale("pt-BR").toFormat("cccc, dd 'de' LLLL"),
      });
      if (dias.length >= alvo) break;
    }
  }

  return dias;
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
