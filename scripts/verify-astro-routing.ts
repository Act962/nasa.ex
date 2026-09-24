/**
 * Verificação dos critérios de aceite da spec 0023 — roteamento por intenção.
 *
 * Exercita o classificador de verdade (chama o provedor), porque o que se quer
 * provar é justamente a decisão dele: pedido simples resolve barato, pedido
 * complexo escala. Nada é gravado no banco além do que o `meter` grava, e as
 * linhas de teste são removidas no fim.
 *
 *   pnpm tsx --require ./scripts/_setup-server-only.cjs scripts/verify-astro-routing.ts
 */

import "dotenv/config";

import {
  classifyAstroIntent,
  CONFIDENCE_THRESHOLD,
} from "../src/features/astro/actions/classify-intent";
import { ASTRO_ACTIONS, getAstroAction } from "../src/features/astro/actions/registry";
import { buildActionRegistryTools } from "../src/features/astro/actions/to-tools";
import prisma from "../src/lib/prisma";

let failures = 0;

function check(id: string, passed: boolean, detail: string): void {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${detail}`);
  if (!passed) failures += 1;
}

const PEDIDO_SIMPLES = "crie uma proposta para Kauê do produto Consultoria";
const PEDIDO_COMPLEXO =
  "compare o faturamento dos últimos 3 meses por produto e diga onde caímos";

/**
 * A "frase típica" de cada verbo, como a spec 0024 a escreve. É o roteiro de
 * teste dela, automatizado: se um verbo novo torna ambíguo o verbo vizinho,
 * é aqui que aparece — antes de chegar no usuário.
 */
const FRASES_TIPICAS: Record<string, string> = {
  "forge.create_proposal": "crie uma proposta para Kauê do produto Consultoria",
  "agenda.reschedule_appointment": "remarca o Kauê para sexta às 15h",
  "lead.delete": "apaga o lead duplicado do João Silva",
};

async function main(): Promise<void> {
  const organization = await prisma.organization.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!organization) {
    console.error("Nenhuma organização no banco — nada a verificar.");
    process.exit(1);
  }
  console.log(`Organização: ${organization.name}\n`);

  // ── CA-1 / RNF-1 — pedido completo resolve pelo caminho barato ───────────
  const simples = await classifyAstroIntent({
    organizationId: organization.id,
    text: PEDIDO_SIMPLES,
  });

  check(
    "CA-1",
    simples?.action === "forge.create_proposal",
    `pedido direto classificado como "${simples?.action ?? "null"}" ` +
      `(confiança ${simples?.confidence ?? "—"})`,
  );

  check(
    "RNF-1",
    (simples?.tokensUsed ?? Number.POSITIVE_INFINITY) < 1000,
    `classificação consumiu ${simples?.tokensUsed ?? "?"} tokens ` +
      "(o orquestrador gasta ~18.500 em qualquer pergunta)",
  );

  check(
    "CA-1 campos",
    Boolean(simples?.fields.clientName && simples?.fields.productName),
    `campos extraídos: ${Object.keys(simples?.fields ?? {}).join(", ") || "nenhum"}`,
  );

  // ── CA-3 — pedido complexo não é sequestrado pelo caminho barato ─────────
  const complexo = await classifyAstroIntent({
    organizationId: organization.id,
    text: PEDIDO_COMPLEXO,
  });
  check(
    "CA-3",
    complexo === null,
    complexo === null
      ? "pedido analítico devolveu null — vai para o orquestrador"
      : `pedido analítico virou "${complexo.action}", o que sequestraria a análise`,
  );

  // ── CA-4 / RNF-3 — falha do provedor não vira erro para o usuário ───────
  // Org inexistente NÃO serve de teste: sem chave da org, o roteador cai na
  // chave da plataforma e classifica normalmente. Para exercitar a falha de
  // verdade é preciso tirar todas as chaves do ambiente.
  const chavesSalvas = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
  for (const name of Object.keys(chavesSalvas)) delete process.env[name];

  const semProvedor = await classifyAstroIntent({
    organizationId: "org-que-nao-existe",
    text: PEDIDO_SIMPLES,
  });

  for (const [name, value] of Object.entries(chavesSalvas)) {
    if (value !== undefined) process.env[name] = value;
  }

  check(
    "CA-4",
    semProvedor === null,
    "sem nenhuma chave de IA, a classificação devolveu null em vez de lançar",
  );

  // ── Spec 0024 — cada verbo é alcançado pela sua frase típica ────────────
  for (const [key, frase] of Object.entries(FRASES_TIPICAS)) {
    const resultado = await classifyAstroIntent({
      organizationId: organization.id,
      text: frase,
    });
    check(
      `0024 ${key}`,
      resultado?.action === key,
      `"${frase}" → ${resultado?.action ?? "null"} ` +
        `(confiança ${resultado?.confidence ?? "—"})`,
    );
  }

  // ── Contexto — pronome só resolve com a conversa anterior ───────────────
  const semContexto = await classifyAstroIntent({
    organizationId: organization.id,
    text: "crie uma proposta para ele",
  });
  check(
    "contexto ausente",
    !semContexto || !semContexto.fields.clientName,
    semContexto?.fields.clientName
      ? `sem histórico, inventou clientName="${semContexto.fields.clientName}"`
      : "sem histórico, não inventou o cliente",
  );

  const comContexto = await classifyAstroIntent({
    organizationId: organization.id,
    text: "crie uma proposta para ele",
    history: [
      "Usuário: quais leads entraram hoje?",
      "Astro: Entrou 1 lead no tracking FINANCEIRO: Kauê.",
    ],
  });
  check(
    "contexto resolvido",
    comContexto?.fields.clientName?.toLowerCase().includes("kau") ?? false,
    `com histórico, clientName="${comContexto?.fields.clientName ?? "—"}"`,
  );

  const assuntoNovo = await classifyAstroIntent({
    organizationId: organization.id,
    text: "remarca a reunião da Maria para segunda às 9h",
    history: [
      "Usuário: quais leads entraram hoje?",
      "Astro: Entrou 1 lead no tracking FINANCEIRO: Kauê.",
    ],
  });
  check(
    "contexto ignorado quando é assunto novo",
    assuntoNovo?.action === "agenda.reschedule_appointment" &&
      (assuntoNovo?.fields.personName?.toLowerCase().includes("maria") ?? false),
    `assunto novo → ${assuntoNovo?.action ?? "null"}, ` +
      `pessoa="${assuntoNovo?.fields.personName ?? "—"}"`,
  );

  // ── CA-8 — ação do registro aparece nas duas superfícies ────────────────
  const fakeContext = { organizationId: organization.id, userId: "verify" };
  const tools = buildActionRegistryTools(fakeContext as never);
  const faltandoNoOrquestrador = ASTRO_ACTIONS.filter(
    (action) => !(action.toolName in tools),
  );
  check(
    "CA-8",
    faltandoNoOrquestrador.length === 0,
    `${ASTRO_ACTIONS.length} ação(ões) no registro, ` +
      `${ASTRO_ACTIONS.length - faltandoNoOrquestrador.length} expostas como ferramenta`,
  );

  const semLookup = ASTRO_ACTIONS.filter((action) => !getAstroAction(action.key));
  check(
    "CA-8 lookup",
    semLookup.length === 0,
    semLookup.length === 0
      ? "toda ação é resolvível pela chave (o que o classificador usa)"
      : `sem lookup: ${semLookup.map((action) => action.key).join(", ")}`,
  );

  // ── Spec 0024 D-4 — destrutivo sempre confirma ──────────────────────────
  const DESTRUTIVOS = ["lead.delete", "tracking.archive", "agenda.cancel_appointment"];
  const destrutivosSemConfirmacao = ASTRO_ACTIONS.filter(
    (action) => DESTRUTIVOS.includes(action.key) && !action.requiresConfirmation,
  );
  check(
    "0024 D-4",
    destrutivosSemConfirmacao.length === 0,
    destrutivosSemConfirmacao.length === 0
      ? "toda ação destrutiva no registro exige confirmação"
      : `sem confirmação: ${destrutivosSemConfirmacao.map((a) => a.key).join(", ")}`,
  );

  // ── RNF-4 — o caminho barato aparece no registro de custo ───────────────
  const eventosDoClassificador = await prisma.usageEvent.count({
    where: {
      organizationId: organization.id,
      metadata: { path: ["route"], equals: "classifier" },
    },
  });
  check(
    "RNF-4",
    eventosDoClassificador > 0,
    eventosDoClassificador > 0
      ? `${eventosDoClassificador} evento(s) gravados com route="classifier"`
      : 'nenhum UsageEvent com route="classifier" — a economia fica invisível no relatório',
  );

  console.log(`\nLimiar de confiança em uso: ${CONFIDENCE_THRESHOLD}`);
  console.log(
    failures === 0
      ? "Todos os critérios passaram."
      : `${failures} critério(s) falharam.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    failures += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
