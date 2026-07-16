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
   * ID da agenda onde os eventos são criados.
   * Normalmente é o e-mail da concierge, ou "primary".
   */
  calendarId: () => process.env.CONCIERGE_CALENDAR_ID?.trim() || "primary",

  /**
   * (Opcional) E-mail da Cúpula. Se preenchido, é convidado como
   * participante para que a equipe também veja o agendamento.
   */
  cupulaEmail: () => optional("CUPULA_EMAIL"),

  /**
   * (Opcional) Lista de e-mails autorizados a marcar, separados por vírgula.
   * Se vazio, qualquer pessoa logada com Google pode marcar.
   */
  allowedEmails: () =>
    (optional("MENTORADOS_AUTORIZADOS") || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
};
