/**
 * Roteiro de teste do Inter no sandbox (spec 0130, §8): responde P-1 e P-9 e exercita o
 * cliente HTTP e o adapter antes de existir tela ou migration. Não toca o banco do ÓRBITA.
 *
 * Credenciais só no `.env.local` (nunca no chat nem no repositório):
 *   INTER_SANDBOX_CLIENT_ID, INTER_SANDBOX_CLIENT_SECRET,
 *   INTER_SANDBOX_CERT_PATH, INTER_SANDBOX_KEY_PATH (caminho dos arquivos .crt e .key),
 *   INTER_SANDBOX_PIX_KEY (chave PIX da conta de teste, vista no portal do sandbox).
 *
 * USO: pnpm tsx --require ./scripts/_setup-server-only.cjs scripts/inter-sandbox-check.ts
 * O sandbox só funciona de segunda a sexta, das 8h às 20h.
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

config({ path: ".env.local" });
config();

import { InterApiError, requestInterToken } from "../src/http/inter/client";
import { inspectInterCertificate } from "../src/http/inter/certificate";
import { createInterCobv, paySandboxInterCobv } from "../src/http/inter/cobv";
import { INTER_CHARGE_SCOPES, INTER_SANDBOX_EXTRA_SCOPES, findMoneyMovingScopes } from "../src/http/inter/scopes";
import { getInterPixWebhook } from "../src/http/inter/webhook";
import { createInterChargeProvider } from "../src/features/payment/server/bank-charges/inter-charge-provider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} no .env.local.`);
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
  const certificatePem = readFileSync(requireEnv("INTER_SANDBOX_CERT_PATH"), "utf8");
  const privateKeyPem = readFileSync(requireEnv("INTER_SANDBOX_KEY_PATH"), "utf8");
  const pixKey = requireEnv("INTER_SANDBOX_PIX_KEY");
  const credentials = {
    env: "sandbox" as const,
    clientId: requireEnv("INTER_SANDBOX_CLIENT_ID"),
    clientSecret: requireEnv("INTER_SANDBOX_CLIENT_SECRET"),
    certificatePem,
    privateKeyPem,
  };

  const certificate = inspectInterCertificate(certificatePem, privateKeyPem);
  if (!certificate.ok) throw new Error(certificate.reason);
  console.log(`✅ Certificado e chave formam par; vale até ${certificate.info.validTo.toLocaleDateString("pt-BR")}`);

  const token = await step("Token com os escopos do v1 + pix.write do sandbox", () =>
    requestInterToken(credentials, [...INTER_CHARGE_SCOPES, ...INTER_SANDBOX_EXTRA_SCOPES]),
  );
  if (!token) return;
  console.log("   escopos concedidos:", token.scope);
  const moneyMoving = findMoneyMovingScopes(token.scope.split(" "));
  if (moneyMoving.length) console.log("   ⚠️  escopos que movem dinheiro:", moneyMoving.join(", "));

  const context = { ...credentials, accessToken: token.access_token };
  const dueDate = daysFromToday(5);

  console.log("\nP-1 — a cobrança com vencimento exige devedor?");
  await step("cobv SEM devedor", () =>
    createInterCobv(context, randomTxid(), {
      calendario: { dataDeVencimento: dueDate, validadeAposVencimento: 30 },
      valor: { original: "1.00" },
      chave: pixKey,
    }),
  );
  await step("cobv com devedor vazio ({})", () =>
    createInterCobv(context, randomTxid(), {
      calendario: { dataDeVencimento: dueDate, validadeAposVencimento: 30 },
      devedor: {} as never,
      valor: { original: "1.00" },
      chave: pixKey,
    }),
  );

  console.log("\nAdapter — criar, repetir, pagar no sandbox e conferir");
  const provider = createInterChargeProvider({
    env: "sandbox",
    certificatePem,
    privateKeyPem,
    pixKey,
    accountNumber: null,
    getAccessToken: async () => token.access_token,
  });
  const txid = randomTxid();
  const request = {
    txid,
    amountCents: 150,
    dueDate,
    daysValidAfterDue: 30,
    debtor: { name: "Cliente Teste", document: "12345678909" },
    payerMessage: "Teste ÓRBITA",
  };
  const charge = await step("upsertPixCharge cria", () => provider.upsertPixCharge(request));
  if (!charge) return;
  console.log("   copia e cola:", charge.copyPaste.slice(0, 40), "…");
  await step("upsertPixCharge repetido não cria outra (mesmo txid)", () => provider.upsertPixCharge(request));
  await step("upsertPixCharge revisa o valor (R$ 2,00)", () =>
    provider.upsertPixCharge({ ...request, amountCents: 200 }),
  );

  const payment = await step("pagar no sandbox (R$ 2,00)", () => paySandboxInterCobv(context, txid, 2));
  if (payment) {
    const confirmed = await step("confirmPixPayment pelo endToEndId", () => provider.confirmPixPayment(payment.e2e));
    if (confirmed) console.log("   ", JSON.stringify({ ...confirmed, raw: undefined }));
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const listed = await step("listPixPayments na última hora", () =>
      provider.listPixPayments({ since, until: new Date() }),
    );
    if (listed) console.log(`   ${listed.length} PIX; o pago aparece: ${listed.some((pix) => pix.txid === txid)}`);
  }

  console.log("\nWebhook");
  await step("consultar webhook da chave", async () => {
    const webhook = await getInterPixWebhook(context, pixKey);
    console.log("   ", webhook ? webhook.webhookUrl : "nenhum cadastrado");
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
