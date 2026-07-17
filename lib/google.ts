import { google, calendar_v3 } from "googleapis";
import { env } from "@/lib/env";

/** Cliente OAuth2 autenticado com um refresh token. */
function oauth2For(refreshToken: string) {
  const client = new google.auth.OAuth2(
    env.googleClientId(),
    env.googleClientSecret()
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/**
 * Cria um cliente do Google Calendar autenticado com um refresh token.
 */
function clientFor(refreshToken: string): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth: oauth2For(refreshToken) });
}

/**
 * Cria uma sala do Google Meet JÁ com as opções ativadas: gravação +
 * transcrição + notas do Gemini automáticas, entrada livre e gerenciamento
 * de organizadores. Retorna o link e o código da sala, ou null se não der
 * (aí o evento usa um Meet normal).
 *
 * Obs.: a gravação em si só começa quando uma conta AUTORIZADA (da
 * organização, ex.: @cupulared) entra na reunião — é regra do Google.
 */
async function criarSalaMeetComGravacao(): Promise<{
  uri: string;
  code: string;
} | null> {
  try {
    const auth = oauth2For(env.centralRefreshToken());
    const at = await auth.getAccessToken();
    const token = typeof at === "string" ? at : at?.token;
    if (!token) return null;

    // Entrada livre + gerenciamento de organizadores em todas as tentativas.
    const base = { accessType: "OPEN" as const, moderation: "ON" as const };

    // Do mais completo ao mais simples: se o Workspace não suportar algum
    // recurso, cai para a próxima opção em vez de falhar.
    const tentativas: Record<string, unknown>[] = [
      {
        ...base,
        artifactConfig: {
          recordingConfig: { autoRecordingGeneration: "ON" },
          transcriptionConfig: { autoTranscriptionGeneration: "ON" },
          smartNotesConfig: { autoSmartNotesGeneration: "ON" },
        },
      },
      {
        ...base,
        artifactConfig: {
          recordingConfig: { autoRecordingGeneration: "ON" },
          transcriptionConfig: { autoTranscriptionGeneration: "ON" },
        },
      },
      { ...base, artifactConfig: { recordingConfig: { autoRecordingGeneration: "ON" } } },
    ];

    for (const config of tentativas) {
      const res = await fetch("https://meet.googleapis.com/v2/spaces", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config }),
      });

      if (res.ok) {
        const space = await res.json();
        if (space?.meetingUri && space?.meetingCode) {
          return { uri: space.meetingUri, code: space.meetingCode };
        }
        return null;
      }

      console.error(
        "Tentativa de criar sala Meet com gravação falhou:",
        res.status,
        JSON.stringify(config.artifactConfig),
        await res.text()
      );
    }

    return null;
  } catch (e) {
    console.error("Erro ao criar sala Meet com gravação:", e);
    return null;
  }
}

/**
 * Agenda da CONCIERGE — usada para LER os horários ocupados
 * (disponibilidade) e para guardar as configurações do painel.
 */
export function calendarClient(): calendar_v3.Calendar {
  return clientFor(env.calendarRefreshToken());
}

/**
 * Agenda CENTRAL — onde os eventos são CRIADOS (organizadora, grava
 * as reuniões). Cai na agenda da concierge se não estiver configurada.
 */
function centralClient(): calendar_v3.Calendar {
  return clientFor(env.centralRefreshToken());
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
  socioNome?: string;
  socioEmail?: string;
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
  const calendar = centralClient();

  const attendees: calendar_v3.Schema$EventAttendee[] = [
    { email: params.menteeEmail, displayName: params.menteeNome },
  ];
  // Concierge entra como convidada (co-participante), não como dona.
  const conciergeEmail = env.conciergeEmail();
  if (env.centralConfigured() && conciergeEmail) {
    attendees.push({ email: conciergeEmail });
  }
  if (params.socioEmail) {
    attendees.push({
      email: params.socioEmail,
      displayName: params.socioNome,
    });
  }
  if (params.cupulaEmail) {
    attendees.push({ email: params.cupulaEmail });
  }

  // requestId precisa ser único por criação de conferência.
  const requestId = `cupula-${params.inicioISO}-${params.menteeEmail}`.replace(
    /[^a-zA-Z0-9-]/g,
    ""
  );

  // Se a gravação estiver ligada, cria uma sala do Meet JÁ com gravação +
  // transcrição + Gemini ativados e anexa ao evento. Se não der, usa um
  // Meet normal (createRequest) para o evento não ficar sem link.
  let conferenceData: calendar_v3.Schema$ConferenceData;
  let meetLinkPre: string | undefined;
  const sala = env.gravarReunioes() ? await criarSalaMeetComGravacao() : null;
  if (sala) {
    conferenceData = {
      conferenceId: sala.code,
      conferenceSolution: { key: { type: "hangoutsMeet" }, name: "Google Meet" },
      entryPoints: [{ entryPointType: "video", uri: sala.uri, label: sala.uri }],
    };
    meetLinkPre = sala.uri;
  } else {
    conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const res = await calendar.events.insert({
    calendarId: env.centralCalendarId(),
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
      conferenceData,
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
    meetLinkPre ||
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
  const calendar = centralClient();
  const res = await calendar.events.list({
    calendarId: env.centralCalendarId(),
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
  const calendar = centralClient();
  await calendar.events.delete({
    calendarId: env.centralCalendarId(),
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
