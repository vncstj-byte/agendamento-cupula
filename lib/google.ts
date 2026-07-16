import { google, calendar_v3 } from "googleapis";
import { env } from "@/lib/env";

/**
 * Cliente do Google Calendar autenticado como a conta DONA da agenda
 * da concierge (via refresh token guardado no .env).
 *
 * É com este cliente que lemos os horários ocupados e criamos os
 * eventos das mentorias — sempre na agenda da concierge.
 */
function oauthClient() {
  const client = new google.auth.OAuth2(
    env.googleClientId(),
    env.googleClientSecret()
  );
  client.setCredentials({ refresh_token: env.calendarRefreshToken() });
  return client;
}

export function calendarClient(): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth: oauthClient() });
}

export interface BusyPeriod {
  start: string; // ISO
  end: string; // ISO
}

/**
 * Consulta os intervalos ocupados na agenda da concierge entre
 * duas datas. Usado para esconder horários que já têm compromisso.
 */
export async function getBusyPeriods(
  timeMin: string,
  timeMax: string
): Promise<BusyPeriod[]> {
  const calendar = calendarClient();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: env.calendarId() }],
    },
  });

  const cal = res.data.calendars?.[env.calendarId()];
  const busy = cal?.busy ?? [];
  return busy
    .filter((b): b is { start: string; end: string } =>
      Boolean(b.start && b.end)
    )
    .map((b) => ({ start: b.start, end: b.end }));
}

export interface CriarEventoParams {
  inicioISO: string;
  fimISO: string;
  timezone: string;
  menteeNome: string;
  menteeEmail: string;
  cupulaEmail?: string;
  titulo: string;
  descricao: string;
}

export interface EventoCriado {
  id: string;
  htmlLink: string;
  meetLink?: string;
  inicioISO: string;
  fimISO: string;
}

/**
 * Cria o evento da mentoria na agenda da concierge, já com link do
 * Google Meet e convidando o mentorado (e, opcionalmente, a Cúpula).
 */
export async function criarEvento(
  params: CriarEventoParams
): Promise<EventoCriado> {
  const calendar = calendarClient();

  const attendees: calendar_v3.Schema$EventAttendee[] = [
    { email: params.menteeEmail, displayName: params.menteeNome },
  ];
  if (params.cupulaEmail) {
    attendees.push({ email: params.cupulaEmail });
  }

  // requestId precisa ser único por criação de conferência.
  const requestId = `cupula-${params.inicioISO}-${params.menteeEmail}`.replace(
    /[^a-zA-Z0-9-]/g,
    ""
  );

  const res = await calendar.events.insert({
    calendarId: env.calendarId(),
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: params.titulo,
      description: params.descricao,
      start: { dateTime: params.inicioISO, timeZone: params.timezone },
      end: { dateTime: params.fimISO, timeZone: params.timezone },
      attendees,
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    },
  });

  const data = res.data;
  const meetLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
      ?.uri ||
    undefined;

  return {
    id: data.id ?? "",
    htmlLink: data.htmlLink ?? "",
    meetLink,
    inicioISO: params.inicioISO,
    fimISO: params.fimISO,
  };
}
