/**
 * Roteiro de teste da API do Inter (spec 0130, §8): responde P-1, P-9 e P-10 e exercita o
 * cliente HTTP e o adapter antes de existir tela ou migration. Não toca o banco do ÓRBITA.
 *
 * Credenciais só no `.env.local` (nunca no chat nem no repositório); `.crt` e `.key` ficam
 * FORA da pasta do projeto:
 *   INTER_ENV=sandbox|production (padrão: sandbox)
 *   INTER_CLIENT_ID, INTER_CLIENT_SECRET,
 *   INTER_CERT_PATH, INTER_KEY_PATH (caminho dos arquivos .crt e .key),
 *   INTER_PIX_KEY (chave PIX da conta), INTER_ACCOUNT_NUMBER (opcional: conta com dígito,
 *   só quando a integração tem mais de uma conta).
 *   INTER_TEST_DEBTOR_DOCUMENT / INTER_TEST_DEBTOR_NAME (opcionais: CPF/CNPJ e nome de quem vai
 *   pagar o teste, se o P-1 mostrar que a cobrança exige devedor).
 *
 * USO (prefixo: pnpm tsx --require ./scripts/_setup-server-only.cjs scripts/inter-api-check.ts):
 *   (sem argumento)     certificado, token, escopos, P-1 e o adapter. Em produção deixa UMA
 *                       cobrança de R$ 1,00 ativa e mostra o copia e cola para alguém da
 *                       equipe pagar; as outras cobranças de teste são removidas.
 *   --confirm <txid>    confere no Inter se a cobrança foi paga (o que a baixa automática fará).
 *   --cancel <txid>     remove a cobrança de teste que não foi paga.
 *
 * Produção: o token pede só os escopos do v1 — nunca `pix.write` nem `pagamento-*`.
 * O Inter pode recusar IP dinâmico com 406; nesse caso o teste precisa rodar no servidor.
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

config({ path: ".env.local" });
config();

import { InterApiError, requestInterToken } from "../src/http/inter/client";
import { inspectInterCertificate } from "../src/http/inter/certificate";
import { createInterCobv, paySandboxInterCobv, removeInterCobv } from "../src/http/inter/cobv";
import { INTER_CHARGE_SCOPES, INTER_SANDBOX_EXTRA_SCOPES, findMoneyMovingScopes } from "../src/http/inter/scopes";
import type { InterCallContext, InterEnv } from "../src/http/inter/types";
import { getInterPixWebhook } from "../src/http/inter/webhook";
import { createInterChargeProvider } from "../src/features/payment/server/bank-charges/inter-charge-provider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} no .env.local.`);
  return value;
}

function readEnvName(): InterEnv {
  const value = process.env.INTER_ENV ?? "sandbox";
  if (value !== "sandbox" && value !== "production") throw new Error("INTER_ENV deve ser sandbox ou production.");
  return value;
}

function randomTxid(): string {
  return `orbtest${randomBytes(12).toString("hex")}`;
}

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function step<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    const result = await run();
    console.log(`✅ ${label}`);
    return result;
  } catch (error) {
    const message = error instanceof InterApiError ? `${error.status} — ${error.message}` : String(error);
    console.log(`❌ ${label}: ${message}`);
    if (error instanceof InterApiError && error.problem) console.log("   ", JSON.stringify(error.problem));
    return null;
  }
}

async function main() {
  const env = readEnvName();
  const isProduction = env === "production";
  const certificatePem = readFileSync(requireEnv("INTER_CERT_PATH"), "utf8");
  const privateKeyPem = readFileSync(requireEnv("INTER_KEY_PATH"), "utf8");
  const pixKey = requireEnv("INTER_PIX_KEY");
  const accountNumber = process.env.INTER_ACCOUNT_NUMBER || null;
  const credentials = {
    env,
    clientId: requireEnv("INTER_CLIENT_ID"),
    clientSecret: requireEnv("INTER_CLIENT_SECRET"),
    certificatePem,
    privateKeyPem,
  };
  console.log(`Ambiente: ${isProduction ? "PRODUÇÃO" : "sandbox"}\n`);

  const certificate = inspectInterCertificate(certificatePem, privateKeyPem);
  if (!certificate.ok) throw new Error(certificate.reason);
  console.log(`✅ Certificado e chave formam par; vale até ${certificate.info.validTo.toLocaleDateString("pt-BR")}`);

  const scopes = isProduction ? [...INTER_CHARGE_SCOPES] : [...INTER_CHARGE_SCOPES, ...INTER_SANDBOX_EXTRA_SCOPES];
  const token = await step(`Token com os escopos ${scopes.join(" ")}`, () => requestInterToken(credentials, scopes));
  if (!token) {
    console.log("   406 = IP bloqueado pelo Inter (rodar no servidor); 400/401 = credencial ou escopo.");
    return;
  }
  console.log("   escopos concedidos:", token.scope);
  const moneyMoving = findMoneyMovingScopes(token.scope.split(" "));
  if (moneyMoving.length) console.log("   ⚠️  escopos que movem dinheiro no token:", moneyMoving.join(", "));

  const context: InterCallContext = { ...credentials, accountNumber, accessToken: token.access_token };
  const provider = createInterChargeProvider({
    env,
    certificatePem,
    privateKeyPem,
    pixKey,
    accountNumber,
    getAccessToken: async () => token.access_token,
  });

  const [mode, targetTxid] = process.argv.slice(2);
  if (mode === "--confirm" || mode === "--cancel") {
    if (!targetTxid) throw new Error(`Informe o txid: ${mode} <txid>`);
    if (mode === "--cancel") {
      await step(`remover a cobrança ${targetTxid}`, () => provider.cancelPixCharge(targetTxid));
      return;
    }
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const listed = await step("PIX de cobrança recebidos nas últimas 48 h", () =>
      provider.listPixPayments({ since, until: new Date() }),
    );
    const paid = listed?.find((pix) => pix.txid === targetTxid);
    if (!paid) {
      console.log("   Ainda não consta pagamento para este txid.");
      return;
    }
    const confirmed = await step("conferir o pagamento pelo endToEndId", () => provider.confirmPixPayment(paid.endToEndId));
    if (confirmed) {
      console.log("   ", JSON.stringify({ ...confirmed, raw: undefined }));
      console.log("    campos devolvidos pelo Inter:", Object.keys(confirmed.raw).join(", "));
    }
    return;
  }

  const dueDate = daysFromToday(5);
  console.log("\nP-1 — a cobrança com vencimento exige devedor?");
  const probeTxids = [randomTxid(), randomTxid(), randomTxid()];
  await step("cobv SEM devedor", () =>
    createInterCobv(context, probeTxids[0], {
      calendario: { dataDeVencimento: dueDate, validadeAposVencimento: 30 },
      valor: { original: "1.00" },
      chave: pixKey,
    }),
  );
  await step("cobv com devedor vazio ({})", () =>
    createInterCobv(context, probeTxids[1], {
      calendario: { dataDeVencimento: dueDate, validadeAposVencimento: 30 },
      devedor: {} as never,
      valor: { original: "1.00" },
      chave: pixKey,
    }),
  );
  await step("cobv com devedor só com nome (sem CPF/CNPJ)", () =>
    createInterCobv(context, probeTxids[2], {
      calendario: { dataDeVencimento: dueDate, validadeAposVencimento: 30 },
      devedor: { nome: "Teste ÓRBITA" } as never,
      valor: { original: "1.00" },
      chave: pixKey,
    }),
  );
  for (const txid of probeTxids) await removeInterCobv(context, txid).catch(() => undefined);

  console.log("\nAdapter — criar, repetir e revisar");
  const txid = randomTxid();
  const request = {
    txid,
    amountCents: 200,
    dueDate,
    daysValidAfterDue: 30,
    debtor: process.env.INTER_TEST_DEBTOR_DOCUMENT
      ? { name: process.env.INTER_TEST_DEBTOR_NAME ?? "Teste ÓRBITA", document: process.env.INTER_TEST_DEBTOR_DOCUMENT }
      : null,
    payerMessage: "Teste de integração ÓRBITA",
  };
  const charge = await step("upsertPixCharge cria (R$ 2,00)", () => provider.upsertPixCharge(request));
  if (!charge) return;
  await step("upsertPixCharge repetido não cria outra (mesmo txid)", () => provider.upsertPixCharge(request));
  const revised = await step("upsertPixCharge revisa para R$ 1,00", () =>
    provider.upsertPixCharge({ ...request, amountCents: 100 }),
  );

  if (isProduction) {
    console.log(`\n💳 Cobrança de teste ativa — txid: ${txid}`);
    console.log("   Pague pelo app de outra conta com este copia e cola:\n");
    console.log((revised ?? charge).copyPaste);
    console.log("\n   Depois: --confirm", txid, "  (ou --cancel", txid, "se não for pagar)");
  } else {
    const payment = await step("pagar no sandbox (R$ 1,00)", () => paySandboxInterCobv(context, txid, 1));
    if (payment) {
      const confirmed = await step("confirmPixPayment pelo endToEndId", () => provider.confirmPixPayment(payment.e2e));
      if (confirmed) console.log("   ", JSON.stringify({ ...confirmed, raw: undefined }));
    }
  }

  console.log("\nWebhook (só leitura — nada é cadastrado)");
  await step("consultar webhook da chave", async () => {
    const webhook = await getInterPixWebhook(context, pixKey);
    console.log("   ", webhook ? webhook.webhookUrl : "nenhum cadastrado");
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
