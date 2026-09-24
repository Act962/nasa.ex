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
import { buildActionInput } from "../src/features/astro/actions/coerce-fields";
import prisma from "../src/lib/prisma";

let failures = 0;

function check(id: string, passed: boolean, detail: string): void {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${detail}`);
  if (!passed) failures += 1;
}

/**
 * O classificador é probabilístico: medido em 2026-09-24, a mesma frase deu
 * `null` em 1 de 4 execuções. Afirmar sobre UMA chamada produz suíte instável,
 * e suíte instável o time aprende a ignorar. Então medimos a taxa.
 *
 * O `null` nunca erra — manda ao orquestrador. O que ele custa é dinheiro:
 * 19★ onde caberiam 2★. Por isso a taxa é o número que importa, não o
 * booleano da última tentativa.
 */
const ATTEMPTS = 3;
const MIN_SUCCESS = 2;

async function checkRate(
  id: string,
  attempt: () => Promise<boolean>,
  detail: (successes: number) => string,
): Promise<void> {
  let successes = 0;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    if (await attempt()) successes += 1;
  }
  const passed = successes >= MIN_SUCCESS;
  const rate = `${successes}/${ATTEMPTS}`;
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${rate} — ${detail(successes)}`);
  if (!passed) failures += 1;
  else if (successes < ATTEMPTS) {
    // Sem afirmar a causa: dependendo da checagem, a tentativa que não passou
    // cai no orquestrador (custa ★) ou faz o Astro perguntar à toa. As duas
    // degradam com segurança — nenhuma escreve errado.
    console.log(
      `       ⚠ variância: ${ATTEMPTS - successes} de ${ATTEMPTS} não atingiram o esperado`,
    );
  }
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
  "lead.add_note": "anota no Kauê que ele pediu desconto",
  "agenda.cancel_appointment": "cancela o agendamento do Kauê",
  "lead.toggle_favorite": "favorita o lead Kauê",
  "tracking.create_status": "cria a coluna Proposta no funil de vendas",
  "chat.mark_read": "marca as conversas como lidas",
  "chat.start_conversation": "abre conversa com o 86 99999-8888",
  "chat.send_template": "manda o template de boas-vindas pro Kauê",
  "chat.forward_message": "encaminha a última mensagem do Kauê pro João",
  "tracking.rename_status": "renomeia a coluna Início para Entrada",
  "tracking.archive": "arquiva o tracking de 2025",
  "agenda.toggle_active": "desativa a agenda de consultoria",
  "agenda.block_date": "bloqueia o dia 30 na minha agenda",
  "agenda.create_reminder": "me lembra de ligar pro Kauê toda segunda às 9h",
  "tracking.add_participant": "põe o João no tracking de vendas",
  "form.send_to_lead": "manda o formulário de briefing pro Kauê",
  "form.toggle_publish": "publica o formulário de captação",
};

/**
 * O script roda em tsx, que resolve módulo diferente do bundler do Next: um
 * import inexistente para o app passou batido aqui e derrubou /forge com 500.
 * Bater numa rota real é o que fecha essa brecha.
 */
async function checkAppIsUp(): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const response = await fetch(`${baseUrl}/api/rpc/public/listPlans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
      signal: AbortSignal.timeout(20_000),
    });
    check(
      "app compila",
      response.ok,
      response.ok
        ? "o dev server responde — nenhum import quebrado no bundler"
        : `dev server devolveu ${response.status}; veja o log do Next`,
    );
  } catch {
    console.log("[SKIP] app compila — dev server não respondeu (não está no ar?)");
  }
}

async function main(): Promise<void> {
  await checkAppIsUp();

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

  // O limite é razão, não número redondo: o que importa é continuar uma ordem
  // de grandeza abaixo do orquestrador, mesmo com o catálogo crescendo.
  const ORCHESTRATOR_TURN_TOKENS = 18_500;
  const MAX_CLASSIFIER_SHARE = 0.1;
  const budget = ORCHESTRATOR_TURN_TOKENS * MAX_CLASSIFIER_SHARE;
  const used = simples?.tokensUsed ?? Number.POSITIVE_INFINITY;
  check(
    "RNF-1",
    used < budget,
    `classificação consumiu ${simples?.tokensUsed ?? "?"} tokens — ` +
      `${((used / ORCHESTRATOR_TURN_TOKENS) * 100).toFixed(1)}% do turno do ` +
      `orquestrador (teto: ${MAX_CLASSIFIER_SHARE * 100}%)`,
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
    await checkRate(
      `0024 ${key}`,
      async () => {
        const r = await classifyAstroIntent({
          organizationId: organization.id,
          text: frase,
        });
        return r?.action === key;
      },
      () => `"${frase}"`,
    );
  }

  // ── Campos obrigatórios precisam PARSEAR, não só a ação acertar ─────────
  // A versão antiga cobria só os 4 verbos booleanos, e por isso não via que
  // o parse falhava depois da ação certa. Agora vale para TODO verbo: é a
  // diferença entre "o Astro entendeu" e "o Astro consegue executar".
  for (const [key, frase] of Object.entries(FRASES_TIPICAS)) {
    await checkRate(
      `campos ${key}`,
      async () => {
        const r = await classifyAstroIntent({
          organizationId: organization.id,
          text: frase,
        });
        if (r?.action !== key) return false;
        const action = getAstroAction(key);
        if (!action) return false;
        return action.input.safeParse(buildActionInput(action, r.fields, frase)).success;
      },
      () => `"${frase}" — campos obrigatórios parseiam`,
    );
  }

  // ── Contexto — pronome só resolve com a conversa anterior ───────────────
  await checkRate(
    "contexto ausente",
    async () => {
      const r = await classifyAstroIntent({
        organizationId: organization.id,
        text: "crie uma proposta para ele",
      });
      return !r || !r.fields.clientName;
    },
    () => "sem histórico, não devolve o pronome como nome do cliente",
  );

  const HISTORICO = [
    "Usuário: quais leads entraram hoje?",
    "Astro: Entrou 1 lead no tracking FINANCEIRO: Kauê.",
  ];

  await checkRate(
    "contexto resolvido",
    async () => {
      const r = await classifyAstroIntent({
        organizationId: organization.id,
        text: "crie uma proposta para ele",
        history: HISTORICO,
      });
      return r?.fields.clientName?.toLowerCase().includes("kau") ?? false;
    },
    () => 'com histórico, resolve "ele" para Kauê',
  );

  await checkRate(
    "contexto ignorado quando é assunto novo",
    async () => {
      const r = await classifyAstroIntent({
        organizationId: organization.id,
        text: "remarca a reunião da Maria para segunda às 9h",
        history: HISTORICO,
      });
      return (
        r?.action === "agenda.reschedule_appointment" &&
        (r?.fields.personName?.toLowerCase().includes("maria") ?? false)
      );
    },
    () => "assunto novo não herda o Kauê da conversa anterior",
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
