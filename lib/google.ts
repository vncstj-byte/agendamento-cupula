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
      // Marca o evento para conseguirmos localizar o onboarding do mentorado
      // depois (ex.: para reagendar).
      extendedProperties: {
        private: {
          cupulaOnboarding: "1",
          cupulaMentee: params.menteeEmail.toLowerCase(),
        },
      },
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

export interface OnboardingExistente {
  id: string;
  inicioISO: string;
  meetLink?: string;
}

/**
 * Procura o onboarding FUTURO do mentorado (pelo e-mail) na agenda.
 * Usado para evitar dois agendamentos e para permitir reagendar.
 */
export async function buscarOnboardingDoMentee(
  email: string,
  aPartirDeISO: string
): Promise<OnboardingExistente | null> {
  const calendar = calendarClient();
  const res = await calendar.events.list({
    calendarId: env.calendarId(),
    privateExtendedProperty: [
      "cupulaOnboarding=1",
      `cupulaMentee=${email.toLowerCase()}`,
    ],
    timeMin: aPartirDeISO,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 1,
  });
  const ev = res.data.items?.[0];
  if (!ev?.id || !ev.start?.dateTime) return null;
  const meetLink =
    ev.hangoutLink ||
    ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
      ?.uri ||
    undefined;
  return { id: ev.id, inicioISO: ev.start.dateTime, meetLink };
}

/** Cancela (apaga) um evento e avisa os participantes. */
export async function cancelarEvento(eventId: string): Promise<void> {
  const calendar = calendarClient();
  await calendar.events.delete({
    calendarId: env.calendarId(),
    eventId,
    sendUpdates: "all",
  });
}

// ------------------------------------------------------------
//  Armazenamento das configurações do painel
//
//  As configurações editadas pela concierge ficam guardadas num
//  evento OCULTO na própria agenda dela (data fixa no ano 2000,
//  marcado como "livre" e privado). Assim não precisamos de banco
//  de dados e a configuração persiste entre publicações.
// ------------------------------------------------------------

const CONFIG_TAG = "cupulaConfig";
const CONFIG_DATE = "2000-01-01";

/** Lê o JSON de configuração guardado na agenda (ou null se ainda não existe). */
export async function lerConfigEvento(): Promise<string | null> {
  const calendar = calendarClient();
  const res = await calendar.events.list({
    calendarId: env.calendarId(),
    privateExtendedProperty: [`${CONFIG_TAG}=1`],
    timeMin: "2000-01-01T00:00:00Z",
    timeMax: "2000-01-03T00:00:00Z",
    singleEvents: true,
    maxResults: 1,
  });
  const evento = res.data.items?.[0];
  return evento?.description ?? null;
}

/** Grava (cria ou atualiza) o JSON de configuração na agenda. */
export async function gravarConfigEvento(json: string): Promise<void> {
  const calendar = calendarClient();
  const res = await calendar.events.list({
    calendarId: env.calendarId(),
    privateExtendedProperty: [`${CONFIG_TAG}=1`],
    timeMin: "2000-01-01T00:00:00Z",
    timeMax: "2000-01-03T00:00:00Z",
    singleEvents: true,
    maxResults: 1,
  });
  const existente = res.data.items?.[0];

  const requestBody: calendar_v3.Schema$Event = {
    summary: "⚙️ Configuração — A Cúpula (não apagar)",
    description: json,
    start: { date: CONFIG_DATE },
    end: { date: "2000-01-02" },
    transparency: "transparent",
    visibility: "private",
    extendedProperties: { private: { [CONFIG_TAG]: "1" } },
  };

  if (existente?.id) {
    await calendar.events.patch({
      calendarId: env.calendarId(),
      eventId: existente.id,
      requestBody,
    });
  } else {
    await calendar.events.insert({
      calendarId: env.calendarId(),
      requestBody,
    });
  }
}
