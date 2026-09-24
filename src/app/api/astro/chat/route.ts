import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { UIMessage } from "ai";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { streamAstro } from "@/features/astro/server/orchestrator";
import {
  astroChatRequestSchema,
  extractAttachmentRefs,
} from "@/features/astro/schemas/chat-message";
import type { AstroAttachmentRef } from "@/features/astro/server/agents/types";
import type { AgentKey } from "@/features/astro/schemas/agent-config";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { meter } from "@/features/stars/lib/metering";
import { generateAutoTitle } from "@/features/astro/lib/auto-title";
import { classifyStaged } from "@/features/astro/actions/classify-staged";
import {
  runAstroQuery,
  type AstroQueryResult,
} from "@/features/astro/queries/registry";
import { runClassifiedAction } from "@/features/astro/actions/run-classified-action";

/**
 * Ratio de cobrança em Stars por tokens consumidos pelo Astro.
 * 1 Star = 1000 tokens (qualquer tipo — input + output agregados).
 *
 * Justificativa: GPT-4o-mini cobra ~$0.15/1M input + $0.60/1M output.
 * 1000 tokens ≈ $0.00015 (só input) ou $0.0006 (só output).
 * 1 Star tem valor maior que isso → margem positiva.
 *
 * Pra recalibrar: ajuste só esse número. Cobrança é silenciosa (não
 * mostra valor pro user, só debita).
 */
// O preço por token saiu daqui: mora no catálogo, na ação `astro_tokens`
// (unidade "token", divisor 1000). Ajustar não exige mais deploy — e o valor
// deixou de estar duplicado entre esta rota e o bot do WhatsApp.

export const runtime = "nodejs";
export const maxDuration = 120;

type ProviderErrorBody = { error?: { code?: unknown; type?: unknown; message?: unknown } };

// O provedor às vezes entrega o erro como objeto cru (`{ error: { code } }`);
// `String()` nele vira "[object Object]" na tela.
function describeStreamError(streamError: unknown): string {
  const providerError =
    typeof streamError === "object" && streamError !== null
      ? (streamError as ProviderErrorBody).error
      : undefined;
  const errorCode = String(providerError?.code ?? providerError?.type ?? "");
  if (/insufficient_quota|credit_balance_exhausted|billing/i.test(errorCode)) {
    return "O Astro está sem crédito no provedor de IA (OpenAI). Avise o administrador pra recarregar a conta.";
  }
  if (typeof providerError?.message === "string") return providerError.message;
  if (streamError instanceof Error) return streamError.message;
  return "Não consegui responder agora. Tente de novo em instantes.";
}

/**
 * POST /api/astro/chat
 *
 * Endpoint do copiloto. Consumido pelo `useChat` do `@ai-sdk/react` em todas
 * as superfícies do ASTRO (widget global, fullscreen em /home, embeds).
 *
 * Body:
 *   - messages:        UIMessage[] (gerenciado pelo useChat)
 *   - sessionId?:      hidrata e atualiza uma AiSession existente
 *   - context?:        snapshot da rota (orgId/leadId/etc) — vai para o ctx
 *                      do orquestrador e fica no `AiSession.context`
 *   - pinnedAgentKey?: força um sub-agente (usado pelos embeds)
 *
 * Persistência:
 *   - Cria `AiSession` se não houver sessionId.
 *   - No `onFinish` do stream, atualiza `messages` + `lastAgentKey` + `title`.
 *
 * Retorna:
 *   - UI message stream do AI SDK (`toUIMessageStreamResponse`).
 */
/**
 * Chave de rollback da spec 0023: desligada, todo pedido vai direto ao
 * orquestrador — que é exatamente o comportamento anterior à spec.
 */
const ASTRO_INTENT_ROUTING = process.env.ASTRO_INTENT_ROUTING !== "false";

/** Falas anteriores, para o classificador resolver "ele", "a última", etc. */
function extractConversationHistory(messages: UIMessage[]): string[] {
  return messages
    .slice(0, -1)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      if (!Array.isArray(message.parts)) return "";
      const text = message.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join(" ")
        .trim();
      return text ? `${message.role === "user" ? "Usuário" : "Astro"}: ${text}` : "";
    })
    .filter(Boolean);
}

/**
 * O turno anterior do Astro deixou uma pergunta no ar?
 *
 * "Financeiro", respondendo a "qual tracking?", casou com a consulta do
 * financeiro e devolveu contas a pagar. Resposta curta a uma pergunta
 * pendente não é pedido novo — e enquanto houver pergunta no ar, a camada
 * de consulta fica de fora.
 */
const PENDING_QUESTION =
  /me diga:|para eu continuar|qual deles\?|escolha |ou workspace\?|me diga o |qual o nome|em qual /i;

function lastAssistantAsked(messages: UIMessage[]): boolean {
  const lastAssistant = [...messages]
    .slice(0, -1)
    .reverse()
    .find((message) => message.role === "assistant");
  if (!lastAssistant || !Array.isArray(lastAssistant.parts)) return false;
  const text = lastAssistant.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");
  return PENDING_QUESTION.test(text);
}

function extractLastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser || !Array.isArray(lastUser.parts)) return "";
  return lastUser.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

/**
 * Resposta de consulta em código, no mesmo formato de stream que o cliente já
 * renderiza — tabela vira cartão, texto vira mensagem.
 */
function buildQueryResponse(result: AstroQueryResult): Response {
  const toolCallId = `astro-query-${Date.now()}`;
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      if (result.table) {
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: "consulta",
          input: {},
        });
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: result.table,
        });
      }
      const textId = `${toolCallId}-text`;
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: result.text });
      writer.write({ type: "text-end", id: textId });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  console.log("[ASTRO/chat] POST start");
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user || !sessionData.session.activeOrganizationId) {
    console.warn("[ASTRO/chat] no session/org");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = sessionData.user.id;
  const organizationId = sessionData.session.activeOrganizationId;

  const rawBody = await req.json().catch((e) => {
    console.error("[ASTRO/chat] req.json failed", e);
    return null;
  });
  if (!rawBody) {
    return NextResponse.json({ error: "Body ausente" }, { status: 400 });
  }
  console.log("[ASTRO/chat] body keys:", Object.keys(rawBody), {
    sessionId: rawBody.sessionId,
    nMessages: Array.isArray(rawBody.messages) ? rawBody.messages.length : -1,
    pinnedAgentKey: rawBody.pinnedAgentKey,
  });

  let parsed;
  try {
    parsed = astroChatRequestSchema.parse(rawBody);
  } catch (e) {
    console.error("[ASTRO/chat] schema parse failed", e);
    return NextResponse.json(
      { error: "Body inválido", detail: String(e) },
      { status: 400 },
    );
  }

  const uiMessages = parsed.messages as unknown as UIMessage[];

  // O cliente DEVE criar a sessão via `orpc.astro.sessions.create` antes de
  // chamar este endpoint — assim mantemos o fluxo do AI SDK simples (sem
  // truques de header/data-part para devolver o id). Validamos posse aqui.
  const sessionId = parsed.sessionId;
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId obrigatório (chame astro.sessions.create primeiro)" },
      { status: 400 },
    );
  }
  const existing = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, organizationId: true },
  });
  if (
    !existing ||
    existing.userId !== userId ||
    existing.organizationId !== organizationId
  ) {
    return NextResponse.json(
      { error: "Sessão não encontrada" },
      { status: 404 },
    );
  }

  // Org do trafeGO: o cliente contratou tráfego, não a plataforma — ele não
  // tem Stars e não deveria precisar ter. A taxa de serviço já cobre o Astro
  // dele, que só enxerga as tools do próprio pedido.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { appScope: true, starsSuspendedAt: true },
  });
  const isTrafegoScope = organization?.appScope === "trafego";

  // Organização suspensa por falta de Stars não gera resposta. Esta rota não é
  // procedure oRPC, então o middleware de suspensão não a alcança — o bloqueio
  // precisa ser explícito aqui (vazamento V5 do docs/BILLING_ARCHITECTURE.md).
  if (!isTrafegoScope && organization?.starsSuspendedAt) {
    return NextResponse.json(
      {
        error:
          "Conta suspensa por falta de Stars. Recarregue pra voltar a usar o Astro.",
        code: "STARS_SUSPENDED",
      },
      { status: 403 },
    );
  }

  // ── Cobrança de Stars (regra global em AppStarCost: "astro_prompt") ─────
  // Custo fixo de "stake" por prompt — garante que o user tem saldo antes
  // de gerar resposta. Cobrança proporcional aos tokens reais é feita no
  // onFinish abaixo (silenciosa, sem expor valor pro user).
  // Custo zero ou regra ausente = não cobra fixo. Saldo insuficiente = 402.
  try {
    const charge = isTrafegoScope
      ? { skipped: true as const, success: true as const }
      : await chargeStarsByAction(organizationId, "astro_prompt", {
          userId,
          description: "Astro IA — prompt (stake)",
          appSlug: "astro",
        });
    if (!charge.skipped && !charge.success) {
      return NextResponse.json(
        {
          error:
            "Saldo de Stars insuficiente pra usar o Astro. Recarregue ou ajuste o plano.",
        },
        { status: 402 },
      );
    }
  } catch (e) {
    console.error("[ASTRO/chat] charge failed (continuing)", e);
  }

  // ── Roteamento por intenção (spec 0023, RF-3/RF-4) ──────────────────────
  // Antes de montar o orquestrador com as 91 ferramentas, um classificador
  // barato tenta resolver o pedido como ação direta. Qualquer dúvida, falha
  // ou campo faltando cai no orquestrador, que é o comportamento de sempre.
  if (ASTRO_INTENT_ROUTING && !isTrafegoScope) {
    const routingStartedAt = Date.now();
    const lastUserText = extractLastUserText(uiMessages);
    if (lastUserText) {
      // Consulta simples responde em código, antes de qualquer modelo:
      // "quantos leads temos" é um count(), e ia custar 43 mil tokens para
      // voltar "não tenho acesso aos dados".
      const answeringAQuestion = lastAssistantAsked(uiMessages);
      const queried = answeringAQuestion
        ? null
        : await runAstroQuery({
            ctx: { userId, organizationId } as never,
            text: lastUserText,
            history: extractConversationHistory(uiMessages),
          });
      if (queried) {
        console.log(`[ASTRO/chat] consulta em código resolveu: ${queried.key}`);
        return buildQueryResponse(queried.result);
      }

      const conversationHistory = extractConversationHistory(uiMessages);
      const classification = await classifyStaged({
        organizationId,
        text: lastUserText,
        history: conversationHistory,
      });
      if (classification) {
        const classified = await runClassifiedAction({
          ctx: {
            userId,
            organizationId,
            route: parsed.context ?? {},
            sessionId,
            channel: "CHAT",
          } as never,
          classification,
          userText: lastUserText,
          history: conversationHistory,
        });
        if (classified) {
          console.log(
            `[ASTRO/chat] camada ${classified.route} resolveu: ${classified.actionKey} ` +
              `(app ${classification.app})`,
          );
          // RNF-4: o caminho barato também entra no registro de custo, senão
          // a economia fica invisível no relatório — some da conta em vez de
          // aparecer como zero.
          void meter({
            organizationId,
            action: "astro_tokens",
            userId,
            quantity: { unit: "token", amount: classified.tokensUsed },
            appSlug: "astro",
            description: `Astro — ${classified.actionKey} via ${classified.route}`,
            feature: "astro.classifier",
            sessionId,
            cost: {
              kind: "LLM",
              provider: classified.provider,
              modelId: classified.modelId,
              tokens: { totalTokens: classified.tokensUsed },
              latencyMs: Date.now() - routingStartedAt,
            },
            metadata: { route: classified.route, action: classified.actionKey },
          }).catch((error) => {
            console.warn("[ASTRO/chat] métrica do classificador falhou:", error);
          });
          return classified.response;
        }
      }
    }
  }

  // Anexos declarados na última mensagem do usuário (spec 0014, D-3). O
  // arquivo já subiu pela rota REST; aqui só confirmamos que ele é desta
  // organização antes de deixar o modelo enxergar o id.
  const attachments = await resolveMessageAttachments(uiMessages, organizationId);

  let resolvedModel: { provider: string; modelId: string } | null = null;
  let result;
  const startedAt = Date.now();
  try {
    result = await streamAstro({
      ctx: {
        userId,
        organizationId,
        route: parsed.context ?? {},
        pinnedAgentKey: parsed.pinnedAgentKey as AgentKey | undefined,
        attachments,
        sessionId,
        channel: "CHAT",
      },
      uiMessages,
      toolScope: isTrafegoScope ? "trafego" : undefined,
      onModelResolved: (info) => {
        resolvedModel = info;
      },
    });
  } catch (e) {
    console.error("[ASTRO/chat] streamAstro setup failed", e);
    return NextResponse.json(
      { error: "Falha ao iniciar o orquestrador", detail: String(e) },
      { status: 500 },
    );
  }

  // Captura usage de tokens do stream pra:
  //  1) anexar como metadata da última UIMessage (cliente exibe "245 tokens")
  //  2) cobrar Stars proporcional no onFinish (silencioso)
  let capturedTokens = 0;

  return result.toUIMessageStreamResponse({
    onError: (streamError) => {
      console.error("[ASTRO/chat] stream error", streamError);
      return describeStreamError(streamError);
    },
    // Anexa { tokens } na última mensagem do stream (event "finish" do AI SDK).
    // Cliente lê em `message.metadata.tokens` e renderiza no rodapé.
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        const usage = (part as { totalUsage?: { totalTokens?: number } })
          .totalUsage;
        const tokens = usage?.totalTokens ?? 0;
        if (tokens > 0) {
          capturedTokens = tokens;
          return { tokens };
        }
      }
      return undefined;
    },
    onFinish: async ({ messages: finalMessages, isAborted }) => {
      console.log(
        `[ASTRO/chat] stream finish (aborted=${isAborted}, n=${finalMessages.length}, tokens=${capturedTokens})`,
      );
      if (isAborted) return;

      // ── Cobrança extra por tokens consumidos ─────────────────────────
      // Convertida pra Stars via STARS_PER_1K_TOKENS. Não mostramos valor
      // pro user — só registramos a transação. Falha silenciosa: se debit
      // não passar, mantém o fluxo (já cobrou o stake no início).
      if (capturedTokens > 0 && !isTrafegoScope) {
        try {
          await meter({
            organizationId,
            action: "astro_tokens",
            userId,
            quantity: { unit: "token", amount: capturedTokens },
            appSlug: "astro",
            description: `Astro IA — ${capturedTokens.toLocaleString("pt-BR")} tokens`,
            feature: "astro.orchestrator",
            sessionId,
            cost: {
              kind: "LLM",
              provider: resolvedModel?.provider,
              modelId: resolvedModel?.modelId,
              tokens: { totalTokens: capturedTokens },
              latencyMs: Date.now() - startedAt,
            },
          });
        } catch (e) {
          // Saldo insuficiente etc. — só loga, não bloqueia a resposta
          // (já entregamos ao user). Próximo prompt vai falhar no stake.
          console.warn("[ASTRO/chat] token charge failed:", e);
        }
      }

      const firstUserMsg = finalMessages.find((m) => m.role === "user");
      const titleSrc =
        firstUserMsg && Array.isArray((firstUserMsg as any).parts)
          ? (firstUserMsg as any).parts
              .filter((p: any) => p?.type === "text")
              .map((p: any) => p.text)
              .join(" ")
          : "";
      const autoTitle = generateAutoTitle(titleSrc);

      // Só atualiza o título se a sessão ainda não tem um — assim o user
      // pode renomear (via /astro/sessions/update-title) sem ser
      // sobrescrito a cada nova mensagem.
      const current = await prisma.aiSession.findUnique({
        where: { id: sessionId },
        select: { title: true },
      });
      const shouldSetTitle =
        !current?.title || current.title === "Conversa com ASTRO";

      await prisma.aiSession.update({
        where: { id: sessionId },
        data: {
          messages: finalMessages as unknown as object,
          ...(shouldSetTitle ? { title: autoTitle } : {}),
        },
      });
    },
  });
}

/**
 * Lê os data parts de anexo da última mensagem do usuário e devolve só os que
 * pertencem à organização da sessão — um id forjado no cliente não chega ao
 * modelo.
 */
async function resolveMessageAttachments(
  uiMessages: UIMessage[],
  organizationId: string,
): Promise<AstroAttachmentRef[] | undefined> {
  const lastUserMessage = [...uiMessages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return undefined;

  const refs = extractAttachmentRefs(lastUserMessage);
  if (refs.length === 0) return undefined;

  const owned = await prisma.paymentAttachment.findMany({
    where: { id: { in: refs.map((ref) => ref.attachmentId) }, organizationId },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
  });
  if (owned.length === 0) return undefined;

  return owned.map((attachment) => ({
    attachmentId: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
  }));
}
