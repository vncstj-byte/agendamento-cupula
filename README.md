# A Cúpula — Sistema de Agendamento de Mentorias

Sistema de agendamento (estilo Calendly) para o programa de mentoria **A Cúpula**.
O mentorado entra com a conta Google, vê os horários livres da concierge e marca a
sessão. O sistema:

- mostra apenas os horários **dentro das janelas de atendimento** que você configurar;
- **esconde horários já ocupados** no Google Agenda da concierge;
- cria o evento **na agenda da concierge**, já com **link do Google Meet**;
- **convida o mentorado** por e-mail (e, opcionalmente, o e-mail da Cúpula);
- tem um **painel** (`/painel`) onde a concierge ajusta os horários sozinha,
  sem mexer em código.

Não usa banco de dados — a própria Google Agenda é a fonte da verdade. Isso deixa o
sistema simples de manter e publicar.

---

## Visão geral (para quem não é técnico)

Você vai fazer isto uma vez:

1. **Criar um app no Google** (grátis) para permitir o login e o acesso à agenda.
2. **Autorizar a agenda da concierge** rodando um comando (gera um "token").
3. **Configurar os horários de atendimento** (num arquivo simples).
4. **Publicar o site** (recomendo a Vercel — grátis e em poucos cliques).

Depois disso, é só compartilhar o link com os mentorados. 🎉

Se tiver qualquer dúvida em algum passo, me chama que a gente resolve junto.

---

## Passo 1 — Criar o app no Google Cloud

1. Acesse <https://console.cloud.google.com> e crie um projeto (ex.: "Agenda Cúpula").
2. Menu **APIs e Serviços → Biblioteca**: procure por **Google Calendar API** e clique
   em **Ativar**.
3. Menu **APIs e Serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**.
   - Preencha nome do app, e-mail de suporte e e-mail do desenvolvedor.
   - Em **Escopos**, pode deixar como está.
   - Em **Usuários de teste**, adicione o e-mail da concierge e alguns e-mails de
     mentorados para testar (enquanto o app não estiver "publicado").
4. Menu **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **URIs de redirecionamento autorizados** — adicione os dois:
     - `http://localhost:3000/api/auth/callback/google` (para testar no seu PC)
     - `http://localhost:5858/oauth2callback` (para o passo 2 abaixo)
     - E, depois de publicar, o do site real:
       `https://SEU-SITE/api/auth/callback/google`
   - Clique em **Criar** e anote o **Client ID** e o **Client Secret**.

---

## Passo 2 — Configurar o arquivo `.env`

1. Copie o arquivo de exemplo:

   ```bash
   cp .env.example .env
   ```

2. Abra o `.env` e preencha:
   - `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` — do passo 1.
   - `AUTH_SECRET` — gere um valor aleatório com:
     ```bash
     openssl rand -base64 32
     ```
   - `CONCIERGE_CALENDAR_ID` — o e-mail da concierge (ou `primary`).
   - `CUPULA_EMAIL` — (opcional) o e-mail da Cúpula, se quiser que a equipe também
     receba o convite.
   - `ADMIN_EMAILS` — o e-mail da concierge (quem pode acessar o painel `/painel`).

3. **Autorize a agenda da concierge** (gera o `CONCIERGE_REFRESH_TOKEN`):

   ```bash
   npm install
   npm run setup:calendar
   ```

   O terminal vai mostrar um link. Abra no navegador, **faça login com a conta da
   concierge** (a dona da agenda) e autorize. Ao final, copie a linha
   `CONCIERGE_REFRESH_TOKEN=...` que aparecer e cole no seu `.env`.

---

## Passo 3 — Configurar os horários de atendimento

Você tem **duas formas** de configurar os horários:

### a) Pelo painel da concierge (recomendado)

Depois de publicar, a concierge acessa **`/painel`**, entra com a conta Google (o
e-mail precisa estar em `ADMIN_EMAILS`) e ajusta tudo por lá:

- as **janelas de atendimento** de cada dia (é só adicionar/remover faixas de horário);
- a **duração** da sessão, a **folga** entre sessões, a **antecedência mínima** e até
  quantos **dias à frente** o mentorado pode marcar.

As mudanças ficam guardadas na **própria agenda da concierge** (num evento oculto que
não aparece no dia a dia), então valem na hora, sem precisar republicar.

> O horário de almoço é simplesmente o **espaço entre uma janela e outra**. Ex.: manhã
> `09:00–12:00` e tarde `14:00–18:00` = almoço das 12h às 14h.

### b) Pelos padrões iniciais (arquivo)

Os valores INICIAIS ficam em **`config/settings.ts`** (usados enquanto a concierge não
mexe no painel). Já vêm com a agenda da Cúpula:

- Segunda e sexta: **09:00–18:00** (almoço 12:00–14:00)
- Terça a quinta: **10:30–17:30** (almoço 12:00–13:30)
- Sessões de **30 minutos**

---

## Passo 4 — Testar no seu computador

```bash
npm run dev
```

Abra <http://localhost:3000>, clique em **Agendar**, entre com uma conta de teste e
faça uma marcação. Confira se o evento apareceu na agenda da concierge com o link do
Meet.

---

## Passo 5 — Publicar o site (Vercel)

1. Suba este projeto para o GitHub (já está pronto para isso).
2. Acesse <https://vercel.com>, crie uma conta e clique em **Add New → Project**,
   escolhendo este repositório.
3. Em **Environment Variables**, adicione as mesmas do seu `.env`
   (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `CONCIERGE_REFRESH_TOKEN`,
   `CONCIERGE_CALENDAR_ID`, `ADMIN_EMAILS`, `CUPULA_EMAIL` e, se usar,
   `MENTORADOS_AUTORIZADOS`).
   Defina também `AUTH_URL` com a URL final do site (ex.: `https://cupula.vercel.app`).
4. Clique em **Deploy**.
5. Copie a URL final e volte ao **Google Cloud → Credenciais** para adicionar o
   redirecionamento `https://SUA-URL/api/auth/callback/google`.

Pronto! É só compartilhar a URL com os mentorados.

> Dica: quando terminar os testes, publique a tela de consentimento OAuth no Google
> (botão **Publicar app**) para liberar o login a qualquer mentorado, não só aos
> "usuários de teste".

---

## Perguntas frequentes

**Como mudo os horários de atendimento depois?**
O jeito mais fácil é pelo painel `/painel` (mudanças valem na hora). Se preferir mudar
os padrões iniciais, edite `config/settings.ts` e publique de novo.

**Quem pode entrar no painel da concierge?**
Só os e-mails listados em `ADMIN_EMAILS`. Qualquer outro login recebe "sem permissão".

**Quero limitar quem pode marcar.**
Preencha `MENTORADOS_AUTORIZADOS` no `.env` com os e-mails separados por vírgula.

**O evento não aparece na agenda da Cúpula.**
Por padrão, o evento é criado só na agenda da concierge. Preencha `CUPULA_EMAIL` para
que o e-mail da Cúpula seja convidado e o agendamento também apareça lá.

**O mentorado precisa autorizar a própria agenda?**
Não. O login com Google serve só para identificá-lo (nome e e-mail).

---

## Estrutura do projeto

```
config/settings.ts     ← horários/duração PADRÃO (ponto de partida)
lib/auth.ts            ← login do mentorado e da concierge (Google)
lib/google.ts          ← acesso à agenda: ocupados, criar evento, guardar config
lib/settingsStore.ts   ← lê/salva as configurações do painel (na agenda)
lib/schedule.ts        ← geração de horários e dias (cálculo puro)
lib/availability.ts    ← horários livres = janelas − ocupados − antecedência
app/agendar/page.tsx   ← tela de agendamento do mentorado
app/painel/page.tsx    ← painel da concierge (ajusta horários)
app/api/config         ← dias com atendimento (para a tela de agendamento)
app/api/slots          ← horários livres de um dia
app/api/book           ← cria o agendamento
app/api/settings       ← lê/salva configurações (só concierge)
scripts/get-refresh-token.mjs ← autoriza a agenda da concierge (passo 2)
```

---

## Tecnologias

Next.js 15 · Auth.js (NextAuth v5) · Google Calendar API · Luxon · TypeScript.
