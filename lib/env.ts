/**
 * Leitura centralizada das variáveis de ambiente (o arquivo .env).
 * Mantém tudo em um lugar só e avisa cedo quando algo está faltando.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. ` +
        `Confira o seu arquivo .env (veja o .env.example).`
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export const env = {
  /** Credenciais do app Google (usadas no login e na agenda). */
  googleClientId: () => required("AUTH_GOOGLE_ID"),
  googleClientSecret: () => required("AUTH_GOOGLE_SECRET"),

  /** Refresh token da conta que é DONA da agenda da concierge. */
  calendarRefreshToken: () => required("CONCIERGE_REFRESH_TOKEN"),

  /**
   * ID da agenda da CONCIERGE — usada para LER os horários ocupados
   * (disponibilidade). Normalmente o e-mail da concierge, ou "primary".
   */
  calendarId: () => process.env.CONCIERGE_CALENDAR_ID?.trim() || "primary",

  /** E-mail da concierge (para convidá-la como participante). */
  conciergeEmail: () => {
    const e = optional("CONCIERGE_EMAIL");
    if (e) return e;
    const cal = process.env.CONCIERGE_CALENDAR_ID?.trim();
    return cal && cal.includes("@") ? cal : undefined;
  },

  /**
   * Conta CENTRAL onde os eventos são CRIADOS (organizadora — grava as
   * reuniões). Se não configurada, usa a agenda da concierge como reserva,
   * mantendo o comportamento anterior sem quebrar nada.
   */
  centralConfigured: () => Boolean(optional("CENTRAL_REFRESH_TOKEN")),
  centralRefreshToken: () =>
    optional("CENTRAL_REFRESH_TOKEN") || required("CONCIERGE_REFRESH_TOKEN"),
  centralCalendarId: () =>
    optional("CENTRAL_CALENDAR_ID") ||
    process.env.CONCIERGE_CALENDAR_ID?.trim() ||
    "primary",

  /**
   * (Opcional) E-mail da Cúpula. Se preenchido, é convidado como
   * participante para que a equipe também veja o agendamento.
   */
  cupulaEmail: () => optional("CUPULA_EMAIL"),

  /**
   * (Opcional) Se "true", tenta criar a reunião já com GRAVAÇÃO
   * automática (via Google Meet API, com a conta central). Requer a
   * Meet API ativada e um Workspace que suporte gravação. Se falhar,
   * o evento é criado com um Meet normal (sem gravar) — não quebra.
   */
  gravarReunioes: () => {
    const v = (optional("GRAVAR_REUNIOES") || "").toLowerCase();
    return v === "true" || v === "1" || v === "sim";
  },

  /**
   * (Opcional) Lista de e-mails autorizados a marcar, separados por vírgula.
   * Se vazio, qualquer pessoa logada com Google pode marcar.
   */
  allowedEmails: () =>
    (optional("MENTORADOS_AUTORIZADOS") || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),

  /**
   * E-mails que podem acessar o painel de configuração (a concierge).
   * Separados por vírgula. Se vazio, o painel fica indisponível.
   */
  adminEmails: () =>
    (optional("ADMIN_EMAILS") || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
};

/** Indica se o e-mail informado pode acessar o painel. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.adminEmails().includes(email.toLowerCase());
}
