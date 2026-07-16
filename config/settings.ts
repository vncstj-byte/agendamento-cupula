/**
 * ============================================================
 *  CONFIGURAÇÕES DA AGENDA — "A Cúpula"
 * ============================================================
 *
 * Este é o arquivo que você (ou a concierge) edita para definir
 * COMO os horários aparecem para o mentorado.
 *
 * Não precisa saber programar: basta mudar os valores abaixo,
 * mantendo o formato (aspas, vírgulas, colchetes) igual ao exemplo.
 */

export type Janela = [inicio: string, fim: string];

export interface Settings {
  /** Fuso horário usado em TODA a agenda. */
  timezone: string;

  /** Duração de cada sessão de mentoria, em minutos. */
  sessionMinutes: number;

  /** Intervalo (folga) em minutos entre uma sessão e outra. */
  bufferMinutes: number;

  /**
   * Antecedência mínima, em horas, para marcar.
   * Ex.: 24 = o mentorado só consegue marcar com pelo menos 1 dia de antecedência.
   */
  minNoticeHours: number;

  /**
   * Até quantos dias à frente o mentorado pode marcar.
   * Ex.: 30 = mostra os próximos 30 dias.
   */
  horizonDays: number;

  /**
   * Janelas de atendimento da concierge por dia da semana.
   *   1 = segunda, 2 = terça, 3 = quarta, 4 = quinta,
   *   5 = sexta, 6 = sábado, 7 = domingo.
   *
   * Cada dia pode ter uma ou mais janelas: ["09:00", "12:00"] significa
   * "atende das 9h às 12h". Deixe o dia de fora (ou lista vazia) para
   * não atender naquele dia.
   */
  janelas: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, Janela[]>>;
}

export const settings: Settings = {
  timezone: "America/Sao_Paulo",

  sessionMinutes: 60,
  bufferMinutes: 0,
  minNoticeHours: 24,
  horizonDays: 30,

  janelas: {
    1: [["09:00", "12:00"], ["14:00", "17:00"]], // segunda
    2: [["09:00", "12:00"], ["14:00", "17:00"]], // terça
    3: [["09:00", "12:00"], ["14:00", "17:00"]], // quarta
    4: [["09:00", "12:00"], ["14:00", "17:00"]], // quinta
    5: [["09:00", "12:00"]], // sexta
    // 6: sábado — sem atendimento
    // 7: domingo — sem atendimento
  },
};

/** Nome do programa, usado nos títulos e telas. */
export const PROGRAMA = "A Cúpula";
