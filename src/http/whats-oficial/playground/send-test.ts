/* eslint-disable no-console */
/**
 * Playground manual da Fase 1 — verificação dos clients HTTP crus.
 *
 * Como rodar:
 *   pnpm exec tsx src/http/whats-oficial/playground/send-test.ts
 *
 * Modos:
 *   - Sem flag       → roda só os checks offline (HMAC self-check + parse de fixtures).
 *   - `--send`       → ALÉM dos checks offline, envia uma mensagem real ao número
 *                       definido em WHATSAPP_OFICIAL_TEST_TO. Use só com sandbox.
 *
 * Envs lidas (carregadas de `.env.local` ou `.env`):
 *   - WHATSAPP_OFICIAL_ACCESS_TOKEN   (obrigatória para --send)
 *   - WHATSAPP_OFICIAL_PHONE_NUMBER_ID (obrigatória para --send)
 *   - WHATSAPP_OFICIAL_TEST_TO         (obrigatória para --send; E.164 sem `+`)
 *   - WHATSAPP_OFICIAL_APP_SECRET      (opcional; usada no HMAC self-check)
 *
 * Este script NUNCA toca o chat de produção — não escreve no banco, não
 * chama Pusher, não dispara Inngest. É só ping/parse.
 */

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

import {
  isMetaSignatureValid,
  parseWhatsAppOfficialWebhook,
  sendOfficialText,
  unwrapCapturedFixture,
} from "../index";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "../../../..");

// `client.ts` faz `import "dotenv/config"` (lê só `.env`); aqui priorizamos
// `.env.local` para alinhar com o padrão Next. `process.env` é mutável, então
// as funções que leem env só no momento da chamada (HMAC, send) recebem os
// valores corretos depois deste loadEnv.
const envLocal = resolve(PROJECT_ROOT, ".env.local");
const envDefault = resolve(PROJECT_ROOT, ".env");
if (existsSync(envLocal)) loadEnv({ path: envLocal, override: true });
else if (existsSync(envDefault)) loadEnv({ path: envDefault });

const ANSI_GREEN = "\x1b[32m";
const ANSI_RED = "\x1b[31m";
const ANSI_DIM = "\x1b[2m";
const ANSI_RESET = "\x1b[0m";

function ok(label: string, detail?: string) {
  console.log(
    `${ANSI_GREEN}✓${ANSI_RESET} ${label}${detail ? ` ${ANSI_DIM}${detail}${ANSI_RESET}` : ""}`,
  );
}
function fail(label: string, detail?: string) {
  console.log(
    `${ANSI_RED}✗${ANSI_RESET} ${label}${detail ? ` ${ANSI_DIM}${detail}${ANSI_RESET}` : ""}`,
  );
}

function runHmacSelfCheck(): boolean {
  console.log("\n─── HMAC self-check ───");
  const sampleBody = JSON.stringify({ hello: "world", n: 42 });
  const secret =
    process.env.WHATSAPP_OFICIAL_APP_SECRET || "dev-app-secret-fake-1234567890";

  const validHeader = `sha256=${createHmac("sha256", secret).update(sampleBody, "utf8").digest("hex")}`;
  const tamperedHeader = `sha256=${"0".repeat(64)}`;

  const passesValid = isMetaSignatureValid(sampleBody, validHeader, secret);
  passesValid ? ok("válido aceita") : fail("válido aceita");

  const rejectsTampered = !isMetaSignatureValid(
    sampleBody,
    tamperedHeader,
    secret,
  );
  rejectsTampered ? ok("adulterado rejeita") : fail("adulterado rejeita");

  const rejectsMissing = !isMetaSignatureValid(sampleBody, null, secret);
  rejectsMissing ? ok("header ausente rejeita") : fail("header ausente rejeita");

  return passesValid && rejectsTampered && rejectsMissing;
}

function runFixtureParse(): boolean {
  console.log("\n─── Parse de fixtures (jsons/webhooks/*.json) ───");
  const fixtures = [
    "message.json",
    "image.json",
    "audio.json",
    "docs.json",
    "figurinha.json",
    "message-with-image.json",
    "message-with-docs.json",
  ];

  let allOk = true;
  for (const name of fixtures) {
    const path = resolve(HERE, "..", "jsons", "webhooks", name);
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
      const body = unwrapCapturedFixture(raw);
      const parsed = parseWhatsAppOfficialWebhook(body);
      if (!parsed) {
        fail(name, "parse retornou null");
        allOk = false;
        continue;
      }
      const message = parsed.entry[0]?.changes[0]?.value.messages?.[0];
      ok(
        name,
        message ? `type=${message.type} from=${message.from}` : "(sem messages[])",
      );
    } catch (error) {
      fail(name, String(error));
      allOk = false;
    }
  }
  return allOk;
}

async function runRealSend(): Promise<boolean> {
  console.log("\n─── Envio real (sandbox Meta) ───");
  const accessToken = process.env.WHATSAPP_OFICIAL_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_OFICIAL_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_OFICIAL_TEST_TO;

  if (!accessToken || !phoneNumberId || !to) {
    fail(
      "envs ausentes",
      "defina WHATSAPP_OFICIAL_ACCESS_TOKEN, WHATSAPP_OFICIAL_PHONE_NUMBER_ID, WHATSAPP_OFICIAL_TEST_TO",
    );
    return false;
  }

  try {
    const response = await sendOfficialText(accessToken, phoneNumberId, {
      to,
      body: `Hello da NASA — teste Fase 1 (${new Date().toISOString()})`,
    });
    const wamid = response.messages[0]?.id;
    ok("envio aceito", `wamid=${wamid}`);
    return true;
  } catch (error) {
    fail("envio falhou", String((error as Error).message ?? error));
    return false;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldSend = args.has("--send");

  console.log("WhatsApp Oficial — Fase 1 playground");
  console.log(`${ANSI_DIM}CWD=${process.cwd()}${ANSI_RESET}`);

  const hmacOk = runHmacSelfCheck();
  const parseOk = runFixtureParse();
  const sendOk = shouldSend ? await runRealSend() : true;
  if (!shouldSend) {
    console.log(
      `\n${ANSI_DIM}(envio real pulado — passe --send para enviar)${ANSI_RESET}`,
    );
  }

  const allOk = hmacOk && parseOk && sendOk;
  console.log(
    `\n${allOk ? ANSI_GREEN + "TUDO OK" : ANSI_RED + "FALHOU"}${ANSI_RESET}\n`,
  );
  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
