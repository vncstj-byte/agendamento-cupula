#!/usr/bin/env node
/**
 * ============================================================
 *  OBTER O "REFRESH TOKEN" DA AGENDA DA CONCIERGE
 * ============================================================
 *
 * Rode este script UMA vez, no seu computador, para autorizar o
 * sistema a ler e criar eventos na agenda da concierge.
 *
 *   1) Preencha AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET no arquivo .env
 *      (ou informe quando o script pedir).
 *   2) No Google Cloud, cadastre este endereço como "URI de redirecionamento
 *      autorizado" do seu app:  http://localhost:5858/oauth2callback
 *   3) Rode:  npm run setup:calendar
 *   4) Faça login com a conta da CONCIERGE (a dona da agenda).
 *   5) Copie o CONCIERGE_REFRESH_TOKEN que aparecer e cole no .env.
 */

import http from "node:http";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { google } from "googleapis";
import { existsSync, readFileSync } from "node:fs";

const PORT = 5858;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// Carrega variáveis do .env (leitura simples, sem dependências extras).
function loadDotEnv() {
  if (!existsSync(".env")) return {};
  const out = {};
  for (const linha of readFileSync(".env", "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const dotenv = loadDotEnv();
  const rl = createInterface({ input: stdin, output: stdout });

  let clientId = process.env.AUTH_GOOGLE_ID || dotenv.AUTH_GOOGLE_ID;
  let clientSecret =
    process.env.AUTH_GOOGLE_SECRET || dotenv.AUTH_GOOGLE_SECRET;

  if (!clientId) clientId = (await rl.question("Client ID do Google: ")).trim();
  if (!clientSecret)
    clientSecret = (await rl.question("Client Secret do Google: ")).trim();

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\n============================================================");
  console.log("Abra este endereço no navegador e faça login com a conta");
  console.log("da CONCIERGE (a dona da agenda):\n");
  console.log(authUrl);
  console.log("\nAguardando autorização...");
  console.log("============================================================\n");

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url || !req.url.startsWith("/oauth2callback")) {
        res.writeHead(404).end();
        return;
      }
      const url = new URL(req.url, REDIRECT);
      const code = url.searchParams.get("code");
      const err = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
         <h2>${err ? "Autorização negada" : "Autorização concluída!"}</h2>
         <p>${err ? err : "Pode fechar esta aba e voltar ao terminal."}</p>
         </body></html>`
      );
      server.close();
      if (err) reject(new Error(err));
      else if (code) resolve(code);
      else reject(new Error("Sem código de autorização."));
    });
    server.listen(PORT);
  });

  const { tokens } = await oauth2.getToken(code);
  rl.close();

  if (!tokens.refresh_token) {
    console.error(
      "\n⚠️  Não veio um refresh_token. Remova o acesso do app em " +
        "https://myaccount.google.com/permissions e rode de novo."
    );
    process.exit(1);
  }

  console.log("\n✅ Pronto! Seu refresh token é:\n");
  console.log(`${tokens.refresh_token}\n`);
  console.log(
    "Cole no .env (ou na Vercel) na variável certa, conforme a conta que\n" +
      "você acabou de logar:\n" +
      "  • Conta da CONCIERGE  → CONCIERGE_REFRESH_TOKEN\n" +
      "     (agenda de disponibilidade — de onde lemos os horários ocupados)\n" +
      "  • Conta CENTRAL/cupulared → CENTRAL_REFRESH_TOKEN\n" +
      "     (conta que cria e grava a reunião)\n"
  );
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
