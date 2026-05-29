/**
 * Executors de IA do Modo Agente IA.
 *
 *  - AI_DECISION       — Astro escolhe próximo ramo do grafo. Recebe lista
 *                        de branches possíveis + contexto, devolve `chosenOutput`.
 *  - AI_GENERATE_TEXT  — gera mensagem contextualizada (chama nome, varia tom).
 *                        Usado em follow-ups pra não repetir texto.
 *  - AI_VISION         — analisa imagem do lead (comprovante, foto, doc).
 *                        Lê `data.imagePath` no contexto e devolve `extracted`.
 *  - READ_PDF          — extrai texto de PDF e devolve interpretação.
 *
 * Reaproveita `generateText` do `ai` SDK + `openai` (mesma chave que orchestrator
 * e tracking-chat-ai usam). Cobrança em Stars via chargeStarsByAction com as
 * actions definidas em `agent-stars-actions.ts`.
 */
import "server-only";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { AGENT_STARS_ACTIONS } from "../agent-stars-actions";
import { getByPath, interpolate } from "../workflow-context";
import { detectLoopRepetition } from "../loop-detection";
import type { NodeExecutor } from "../run-workflow";

/**
 * Modelo default — `gpt-4o-mini` é barato e suficiente pra decisão/texto.
 * Override por env `AGENT_DEFAULT_MODEL=gpt-4o` se quiser escalar.
 */
function defaultModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY ausente — necessária pros nós de IA do Modo Agente IA.",
    );
  }
  return openai(process.env.AGENT_DEFAULT_MODEL ?? "gpt-4o-mini");
}

/** Modelo com Vision (analisa imagem). */
function visionModel() {
  return openai("gpt-4o-mini");
}

// ─── AI_DECISION ───────────────────────────────────
// data: {
//   prompt: string,                       // "Decida se o lead quer comprar"
//   branches: Array<{id, label, description}>,
//   organizationId: string,               // pra cobrança
// }
export const aiDecisionExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const branches = (data.branches as Array<{
    id: string;
    label: string;
    description?: string;
  }>) ?? [];
  const promptRaw = String(data.prompt ?? "");
  const orgId = String(data.organizationId ?? context.trigger?.organizationId ?? "");

  if (branches.length < 2) {
    return {
      output: { error: "AI_DECISION precisa de pelo menos 2 ramos" },
      status: "FAILED",
      errorMessage: "branches insuficientes",
    };
  }

  if (dryRun) {
    return {
      output: { dryRun: true, branches: branches.map((b) => b.id) },
      chosenOutput: branches[0].id,
    };
  }

  const branchList = branches
    .map((b, i) => `${i + 1}. ${b.id} — ${b.label}${b.description ? ` (${b.description})` : ""}`)
    .join("\n");

  const systemPrompt = [
    "Você é o Astro, o agente decisor do NASA Auto Agent.",
    "Sua tarefa é escolher exatamente UM ramo do fluxo para continuar, baseado no contexto.",
    "",
    "RAMOS DISPONÍVEIS:",
    branchList,
    "",
    "REGRAS:",
    "- Responda APENAS o ID do ramo (ex: branch_a). Nada mais.",
    "- Se nenhum ramo for adequado, escolha o primeiro como default seguro.",
  ].join("\n");

  // Última mensagem do lead — campo crítico pra IA decidir branches.
  // Vem via `vars.lastIncomingMessage` populada pelo functions.ts quando
  // o engine acorda de WAIT_FOR_EVENT.
  const lastMessage = String(
    (context.vars as Record<string, unknown> | undefined)?.lastIncomingMessage ??
      "",
  );

  const userPrompt = [
    `INSTRUÇÃO DO USUÁRIO: ${interpolate(context, promptRaw)}`,
    "",
    "ÚLTIMA MENSAGEM DO LEAD:",
    lastMessage
      ? `"${lastMessage}"`
      : "(nenhuma mensagem do lead capturada — escolha o ramo de default)",
    "",
    "CONTEXTO DO LEAD:",
    JSON.stringify(context.lead ?? {}, null, 2).slice(0, 2000),
    "",
    "VARIÁVEIS:",
    JSON.stringify(context.vars ?? {}, null, 2).slice(0, 1000),
  ].join("\n");

  const result = await generateText({
    model: defaultModel(),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0,
  });

  const answer = result.text.trim();
  const chosen = branches.find(
    (b) => b.id === answer || answer.toLowerCase().includes(b.id.toLowerCase()),
  );
  const chosenId = chosen?.id ?? branches[0].id;

  if (orgId) {
    await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.AI_DECISION, {
      description: `Decisão IA — escolheu ${chosenId}`,
      appSlug: "agent",
    }).catch((err) => console.warn("[ai-decision charge]", err));
  }

  return {
    output: { chosenBranch: chosenId, reasoning: answer.slice(0, 500) },
    chosenOutput: chosenId,
    starsSpent: 1,
  };
};

// ─── AI_GENERATE_TEXT ──────────────────────────────
// data: { prompt: string, tone?: string, maxTokens?: number, organizationId? }
export const aiGenerateTextExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const promptRaw = String(data.prompt ?? "");
  const tone = String(data.tone ?? "amigável e direto");
  const maxTokens = Number(data.maxTokens ?? 300);
  const orgId = String(data.organizationId ?? context.trigger?.organizationId ?? "");

  if (!promptRaw) {
    return {
      output: { error: "prompt vazio" },
      status: "FAILED",
      errorMessage: "prompt obrigatório",
    };
  }

  if (dryRun) {
    return { output: { text: "(texto gerado em dry-run)" } };
  }

  const systemPrompt = [
    "Você é o NASA Auto Agent gerando uma mensagem WhatsApp pra um lead.",
    `Tom: ${tone}.`,
    "Use o nome do lead se disponível.",
    "Mantenha o texto curto (1-3 parágrafos), em português brasileiro, e termine com 1 pergunta ou call-to-action.",
    "NUNCA invente fatos sobre produtos/preços. Use só o contexto.",
  ].join("\n");

  const userPrompt = [
    `OBJETIVO: ${interpolate(context, promptRaw)}`,
    "",
    "DADOS DO LEAD:",
    JSON.stringify(context.lead ?? {}, null, 2).slice(0, 2000),
    "",
    "HISTÓRICO RECENTE / VARIÁVEIS:",
    JSON.stringify(context.vars ?? {}, null, 2).slice(0, 1500),
  ].join("\n");

  let finalText = "";
  const history = Array.isArray(context.vars.generatedTextHistory)
    ? (context.vars.generatedTextHistory as string[])
    : [];

  // Tenta até 2x — se cosine similarity passar do threshold, injeta
  // instrução de variação no prompt e regera.
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateText({
      model: defaultModel(),
      system:
        attempt === 0
          ? systemPrompt
          : `${systemPrompt}\n\nIMPORTANTE: A última mensagem ficou MUITO parecida com as anteriores. Use abordagem completamente diferente — outro ângulo, outro tom, outro CTA.`,
      prompt: userPrompt,
      maxRetries: 1,
      temperature: 0.7 + attempt * 0.2,
      maxOutputTokens: maxTokens,
    });
    finalText = result.text;

    const loop = detectLoopRepetition(finalText, history, 0.85);
    if (!loop.isRepetition) break;
  }

  if (orgId) {
    await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.AI_TEXT, {
      description: "Texto gerado pelo agente IA",
      appSlug: "agent",
    }).catch((err) => console.warn("[ai-text charge]", err));
  }

  // Mantém histórico capeado em 10 entradas pra cosine não ficar pesado
  const nextHistory = [...history, finalText].slice(-10);

  return {
    output: {
      text: finalText,
      vars: {
        lastGeneratedText: finalText,
        generatedTextHistory: nextHistory,
      },
    },
    starsSpent: 1,
  };
};

// ─── AI_VISION ─────────────────────────────────────
// data: { imagePath: string (no contexto), instruction: string, organizationId? }
export const aiVisionExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const imagePath = String(data.imagePath ?? "");
  const instructionRaw = String(data.instruction ?? "");
  const orgId = String(data.organizationId ?? context.trigger?.organizationId ?? "");

  const imageUrl = getByPath(context, imagePath);
  if (!imageUrl || typeof imageUrl !== "string") {
    return {
      output: { error: `imagem não encontrada em ${imagePath}` },
      status: "FAILED",
      errorMessage: "imagem ausente",
    };
  }

  if (dryRun) {
    return { output: { extracted: "(análise simulada em dry-run)" } };
  }

  const result = await generateText({
    model: visionModel(),
    system:
      "Você analisa imagens enviadas por leads (comprovantes, documentos, fotos). Extraia informações solicitadas em formato estruturado (JSON quando possível). Seja preciso e conciso.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: interpolate(context, instructionRaw) },
          { type: "image", image: new URL(imageUrl) },
        ],
      },
    ],
    temperature: 0,
  });

  if (orgId) {
    await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.AI_VISION, {
      description: "Análise de imagem por IA",
      appSlug: "agent",
    }).catch((err) => console.warn("[ai-vision charge]", err));
  }

  return {
    output: {
      extracted: result.text,
      vars: { lastVisionResult: result.text },
    },
    starsSpent: 3,
  };
};

// ─── READ_PDF ──────────────────────────────────────
// data: { pdfPath: string, instruction?: string, organizationId? }
// Estratégia: download → pdf-parse (extrai texto) → LLM resume/interpreta.
export const readPdfExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const pdfPath = String(data.pdfPath ?? "");
  const instructionRaw = String(
    data.instruction ?? "Resuma o conteúdo principal e liste tópicos-chave.",
  );
  const orgId = String(data.organizationId ?? context.trigger?.organizationId ?? "");

  const pdfUrl = getByPath(context, pdfPath);
  if (!pdfUrl || typeof pdfUrl !== "string") {
    return {
      output: { error: `PDF não encontrado em ${pdfPath}` },
      status: "FAILED",
      errorMessage: "pdf ausente",
    };
  }

  if (dryRun) {
    return { output: { summary: "(resumo simulado em dry-run)" } };
  }

  // Lazy import — pdf-parse só é carregado quando o nó roda
  let extractedText = "";
  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) {
      throw new Error(`Download PDF falhou: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // pdf-parse é commonjs — require dinâmico
    const pdfParseModule = (await import("pdf-parse")).default;
    const parsed = await pdfParseModule(buf);
    extractedText = parsed.text ?? "";
    // Cap pra não estourar tokens — 20k chars ≈ 5k tokens
    if (extractedText.length > 20000) {
      extractedText = extractedText.slice(0, 20000) + "\n...[truncado]";
    }
  } catch (err) {
    return {
      output: { error: err instanceof Error ? err.message : "erro PDF" },
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "erro PDF",
    };
  }

  const result = await generateText({
    model: defaultModel(),
    system:
      "Você lê PDFs e responde perguntas baseado no conteúdo. Cite trechos quando relevante. Não invente nada que não esteja no documento.",
    prompt: [
      `INSTRUÇÃO: ${interpolate(context, instructionRaw)}`,
      "",
      "CONTEÚDO DO PDF:",
      extractedText,
    ].join("\n"),
    temperature: 0,
  });

  if (orgId) {
    await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.PDF_READ, {
      description: "Leitura de PDF por IA",
      appSlug: "agent",
    }).catch((err) => console.warn("[pdf-read charge]", err));
  }

  return {
    output: {
      summary: result.text,
      vars: { lastPdfSummary: result.text },
    },
    starsSpent: 2,
  };
};
