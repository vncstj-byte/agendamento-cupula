import { DateTime } from "luxon";
import { settings } from "@/config/settings";

export interface DiaAtendimento {
  dataISO: string;
  label: string;
}

/**
 * Lista os dias (YYYY-MM-DD) dentro do horizonte configurado que têm
 * pelo menos uma janela de atendimento. Depende apenas da configuração
 * (não consulta a agenda), então é seguro usar no cliente e no servidor.
 */
export function diasComAtendimento(): DiaAtendimento[] {
  const tz = settings.timezone;
  const hoje = DateTime.now().setZone(tz).startOf("day");
  const dias: DiaAtendimento[] = [];

  for (let i = 0; i <= settings.horizonDays; i++) {
    const d = hoje.plus({ days: i });
    const weekday = d.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const janelas = settings.janelas[weekday] ?? [];
    if (janelas.length > 0) {
      dias.push({
        dataISO: d.toISODate()!,
        label: d.setLocale("pt-BR").toFormat("cccc, dd 'de' LLLL"),
      });
    }
  }

  return dias;
}
