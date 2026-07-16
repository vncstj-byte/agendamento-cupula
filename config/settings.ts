/**
 * ============================================================
 *  CONFIGURAÇÕES PADRÃO DA AGENDA — "A Cúpula"
 * ============================================================
 *
 * Estes são os valores INICIAIS do sistema. Depois de publicar, a
 * concierge pode ajustar os horários pelo painel (/painel) sem mexer
 * neste arquivo — as mudanças ficam guardadas na própria agenda dela.
 *
 * Este arquivo serve como ponto de partida (e como reserva, caso o
 * painel ainda não tenha sido usado).
 */

export type Janela = [inicio: string, fim: string];

export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Settings {
  /** Fuso horário usado em TODA a agenda. */
  timezone: string;

  /** Duração de cada sessão, em minutos. */
  sessionMinutes: number;

  /** Intervalo (folga) em minutos entre uma sessão e outra. */
  bufferMinutes: number;

  /** Antecedência mínima, em horas, para marcar. */
  minNoticeHours: number;

  /**
   * Prazo MÁXIMO, em horas, para o onboarding acontecer.
   * Ex.: 48 = só mostra horários dentro das próximas 48 horas.
   * Use 0 para não ter limite máximo.
   * (Regra interna — não é exibida ao mentorado.)
   */
  maxNoticeHours: number;

  /** Até quantos dias à frente o mentorado pode marcar. */
  horizonDays: number;

  /**
   * Janelas de atendimento por dia da semana.
   *   1 = segunda ... 7 = domingo.
   * Cada janela é [início, fim], ex.: ["09:00", "12:00"].
   */
  janelas: Partial<Record<DiaSemana, Janela[]>>;
}

/**
 * Padrões da Cúpula:
 *   Segunda e sexta: 09:00–18:00 (almoço 12:00–14:00)
 *   Terça a quinta:  10:30–17:30 (almoço 12:00–13:30)
 *   Sessões de 30 minutos.
 */
export const defaultSettings: Settings = {
  timezone: "America/Sao_Paulo",

  sessionMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 3,
  maxNoticeHours: 48,
  horizonDays: 30,

  janelas: {
    1: [["09:00", "12:00"], ["14:00", "18:00"]], // segunda
    2: [["10:30", "12:00"], ["13:30", "17:30"]], // terça
    3: [["10:30", "12:00"], ["13:30", "17:30"]], // quarta
    4: [["10:30", "12:00"], ["13:30", "17:30"]], // quinta
    5: [["09:00", "12:00"], ["14:00", "18:00"]], // sexta
  },
};

/** Nome do programa, usado nos títulos e telas. */
export const PROGRAMA = "A Cúpula";

export const DIAS_SEMANA: { valor: DiaSemana; nome: string }[] = [
  { valor: 1, nome: "Segunda-feira" },
  { valor: 2, nome: "Terça-feira" },
  { valor: 3, nome: "Quarta-feira" },
  { valor: 4, nome: "Quinta-feira" },
  { valor: 5, nome: "Sexta-feira" },
  { valor: 6, nome: "Sábado" },
  { valor: 7, nome: "Domingo" },
];
