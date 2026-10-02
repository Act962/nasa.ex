import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { UIMessage } from "ai";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { streamAstro } from "@/features/astro/server/orchestrator";
import {
  astroChatRequestSchema,
  extractAttachmentRefs,
} from "@/features/astro/schemas/chat-message";
import type { AstroAttachmentRef } from "@/features/astro/server/agents/types";
import type { AgentKey } from "@/features/astro/schemas/agent-config";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { meter, recordUsageEvent } from "@/features/stars/lib/metering";
import { reportAiQuotaExhausted } from "@/features/alerts/lib/ai-token-alerts";
import { resolvePreferredModelOverride } from "@/features/astro/lib/resolve-preferred-model";
import { computeChosenModelStars } from "@/features/ai-credits/lib/model-pricing-settings";
import { generateAutoTitle } from "@/features/astro/lib/auto-title";
import {
  ORBITA_PLATFORM_MODEL,
  resolveAstroAiMode,
  type AstroAiMode,
} from "@/features/astro/lib/resolve-astro-ai-mode";
import type { AstroChooseAiPayload } from "@/features/astro/lib/astro-choose-ai";
import {
  runAstroQuery,
  type AstroQueryResult,
} from "@/features/astro/queries/registry";
import { runGuidedAction } from "@/features/astro/actions/run-classified-action";
import { matchGuideRequest } from "@/features/astro-guides/lib/match-guide";
import { toAstroGuidePayload } from "@/features/astro/lib/astro-guide";
import { clearGuidedSlot, isAwaitingAnswer, shouldSkipReading } from "@/features/astro/actions/guided-slots";
import {
  extractConversationHistory,
  extractLastUserText,
  lastAssistantAsked,
} from "@/features/astro/lib/chat-turns";
import {
  cancelPendingAction,
  confirmPendingAction,
  decideLatestCardByText,
} from "@/features/astro/server/tools/_shared/proposals/confirm-direct";

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

/** Conversa em andamento: respostas de atalho também gravam a sessão, senão o Histórico reabre vazio. */
interface ChatTurn {
  sessionId: string;
  originalMessages: UIMessage[];
}

function extractFirstUserText(messages: UIMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "";
  return firstUserMessage.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");
}

async function persistSessionMessages(sessionId: string, finalMessages: UIMessage[]) {
  // Só define o título se a sessão ainda não tem um — o usuário pode renomear
  // (via /astro/sessions/update-title) sem ser sobrescrito a cada mensagem.
  const current = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    select: { title: true },
  });
  const shouldSetTitle = !current?.title || current.title === "Conversa com ASTRO";
  await prisma.aiSession.update({
    where: { id: sessionId },
    data: {
      messages: finalMessages as unknown as object,
      ...(shouldSetTitle ? { title: generateAutoTitle(extractFirstUserText(finalMessages)) } : {}),
    },
  });
}

function persistTurnOnFinish(turn: ChatTurn) {
  return {
    originalMessages: turn.originalMessages,
    onFinish: async ({ messages }: { messages: UIMessage[] }) => {
      try {
        await persistSessionMessages(turn.sessionId, messages);
      } catch (persistError) {
        console.warn("[ASTRO/chat] falha ao salvar resposta de atalho:", persistError);
      }
    },
  };
}

/**
 * Resposta de consulta em código, no mesmo formato de stream que o cliente já
 * renderiza — tabela vira cartão, texto vira mensagem.
 */
function buildQueryResponse(turn: ChatTurn, result: AstroQueryResult): Response {
  const toolCallId = `astro-query-${Date.now()}`;
  const stream = createUIMessageStream({
    ...persistTurnOnFinish(turn),
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

/** Resposta do clique no cartão: mesma forma de stream das tools (spec 0032, RF-10). */
function buildCardResponse(
  turn: ChatTurn,
  toolName: string,
  output: unknown,
  text: string,
  followUp?: unknown,
): Response {
  const toolCallId = `astro-card-${Date.now()}`;
  const stream = createUIMessageStream({
    ...persistTurnOnFinish(turn),
    execute: async ({ writer }) => {
      writer.write({ type: "tool-input-available", toolCallId, toolName, input: {} });
      writer.write({ type: "tool-output-available", toolCallId, output });
      // Plano com parte destrutiva: o cartão dela vem logo abaixo do relatório.
      if (followUp) {
        const followUpId = `${toolCallId}-next`;
        writer.write({ type: "tool-input-available", toolCallId: followUpId, toolName, input: {} });
        writer.write({ type: "tool-output-available", toolCallId: followUpId, output: followUp });
      }
      const textId = `${toolCallId}-text`;
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
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
  const canUseAstro = await hasAppPermission(organizationId, sessionData.user.id, "astro", "canView");
  if (!canUseAstro) {
    return NextResponse.json(
      { error: "Seu papel não tem acesso ao Astro. Fale com o Master (Configurações → Permissões)." },
      { status: 403 },
    );
  }

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

  const chatTurn: ChatTurn = { sessionId, originalMessages: uiMessages };

  // Org do trafeGO: o cliente contratou tráfego, não a plataforma — ele não
  // tem Stars e não deveria precisar ter. A taxa de serviço já cobre o Astro
  // dele, que só enxerga as tools do próprio pedido.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { appScope: true, starsSuspendedAt: true, starsBalance: true, starsBonusBalance: true },
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
  // ── Clique no cartão de confirmação (spec 0032, RF-10) ─────────────────
  // Vem antes da cobrança e do roteamento: o clique é a decisão do usuário,
  // já classificada no turno anterior. Passar isto por modelo custava ~45 mil
  // tokens (~46 Stars) por clique e às vezes voltava a perguntar o cliente.
  const cardReplyText = extractLastUserText(uiMessages).trim();
  if (/^(confirmar|cancelar)\s+[a-z0-9]{10,}$/i.test(cardReplyText)) {
    const [decision, pendingId] = cardReplyText.split(/\s+/);
    const cardCtx = {
      userId,
      organizationId,
      route: parsed.context ?? {},
      sessionId,
      channel: "CHAT" as const,
    } as never;

    if (/^cancelar$/i.test(decision)) {
      const outcome = await cancelPendingAction({ ctx: cardCtx, proposalId: pendingId });
      const text = "error" in outcome ? outcome.error : outcome.summary;
      console.log("[ASTRO/chat] cartão cancelado em código");
      return buildCardResponse(chatTurn, "cancel_action", { summary: text }, text);
    }

    const outcome = await confirmPendingAction({ ctx: cardCtx, proposalId: pendingId });
    console.log(`[ASTRO/chat] cartão confirmado em código (ok=${outcome.ok})`);
    return outcome.ok
      ? buildCardResponse(chatTurn, "confirm_action", outcome.payload, outcome.payload.summary, outcome.payload.followUp)
      : buildCardResponse(chatTurn, "confirm_action", { error: outcome.error }, outcome.error);
  }

  // "cancelar" / "sim" digitados com um cartão aberto (e sem pergunta do
  // roteiro no ar): decide o último cartão desta conversa, em código (F6-02).
  if (!isAwaitingAnswer(sessionId)) {
    const typedCtx = {
      userId,
      organizationId,
      route: parsed.context ?? {},
      sessionId,
      channel: "CHAT" as const,
    } as never;
    const typed = await decideLatestCardByText({ ctx: typedCtx, text: cardReplyText });
    if (typed && "cancelledSummary" in typed) {
      return buildCardResponse(chatTurn, "cancel_action", { summary: typed.cancelledSummary }, typed.cancelledSummary);
    }
    if (typed) {
      return typed.ok
        ? buildCardResponse(chatTurn, "confirm_action", typed.payload, typed.payload.summary, typed.payload.followUp)
        : buildCardResponse(chatTurn, "confirm_action", { error: typed.error }, typed.error);
    }
  }

  // ── Guia na tela (spec 0046, RF-5) ─────────────────────────────────────
  // Antes da cobrança: ensinar a usar a plataforma não usa modelo e não pode
  // depender de saldo. E antes das ações guiadas, senão "como crio um lead?"
  // começava a criar o lead.
  if (!isTrafegoScope) {
    const guideRequestText = extractLastUserText(uiMessages);
    const isAnsweringAQuestion =
      lastAssistantAsked(uiMessages) || shouldSkipReading(sessionId, guideRequestText);
    const requestedGuide = isAnsweringAQuestion ? null : matchGuideRequest(guideRequestText);
    if (requestedGuide) {
      clearGuidedSlot(sessionId);
      void recordUsageEvent({
        organizationId,
        userId,
        kind: "OTHER",
        action: "astro_guide",
        appSlug: "astro",
        feature: "astro.guide",
        tokens: { totalTokens: 0 },
        starsCharged: 0,
        sessionId,
        latencyMs: 0,
        metadata: { guide: requestedGuide.key },
      });
      return buildCardResponse(
        chatTurn,
        "start_guide",
        toAstroGuidePayload(requestedGuide),
        `Te mostro na sua tela, passo a passo. Clique em "Me mostre na tela".`,
      );
    }
  }

  // Sem Stars, nada de pedido novo — mesmo sem stake cadastrado, senão os
  // tokens rodam de graça e o débito deles falha em silêncio (F10-03).
  const hasNoStars =
    (organization?.starsBalance ?? 0) + (organization?.starsBonusBalance ?? 0) <= 0;
  if (!isTrafegoScope && hasNoStars) {
    return NextResponse.json(
      {
        error: "Seus Stars acabaram. Recarregue pra continuar usando o Astro.",
        code: "STARS_EMPTY",
      },
      { status: 402 },
    );
  }

  // Spec 0053: sem IA escolhida, o pedido que precisaria do LLM recebe o cartão
  // de escolha. A taxa fixa só sai quando algum caminho de fato responde (D-3).
  const astroAiMode: AstroAiMode | null = isTrafegoScope
    ? "PLATFORM"
    : await resolveAstroAiMode(organizationId);

  // Custo zero ou regra ausente = não cobra fixo. Saldo insuficiente = 402.
  const chargeAstroStake = async (): Promise<Response | null> => {
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
    return null;
  };
  let isStakePending = astroAiMode === null;
  const chargePendingStake = async (): Promise<Response | null> => {
    if (!isStakePending) return null;
    isStakePending = false;
    return chargeAstroStake();
  };
  if (!isStakePending) {
    const stakeRefusal = await chargeAstroStake();
    if (stakeRefusal) return stakeRefusal;
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
      const answeringAQuestion =
        lastAssistantAsked(uiMessages) || (sessionId ? shouldSkipReading(sessionId, lastUserText) : false);
      const queried = answeringAQuestion
        ? null
        : await runAstroQuery({
            ctx: { userId, organizationId, route: parsed.context ?? {} } as never,
            text: lastUserText,
            history: extractConversationHistory(uiMessages),
          });
      if (queried) {
        console.log(`[ASTRO/chat] consulta em código resolveu: ${queried.key}`);
        // Pergunta nova no meio de um roteiro encerra o roteiro: sem isto, a
        // próxima frase ("Maria Clara") virava resposta à proposta abandonada.
        if (sessionId) clearGuidedSlot(sessionId);
        // RNF-4: consulta em código custa zero, mas entra no relatório — é a
        // economia que o relatório precisa mostrar (F10-01).
        void recordUsageEvent({
          organizationId,
          userId,
          kind: "OTHER",
          action: "astro_query",
          appSlug: "astro",
          feature: "astro.query",
          tokens: { totalTokens: 0 },
          starsCharged: 0,
          sessionId,
          latencyMs: Date.now() - routingStartedAt,
          metadata: { query: queried.key },
        });
        const stakeRefusal = await chargePendingStake();
        if (stakeRefusal) return stakeRefusal;
        return buildQueryResponse(chatTurn, queried.result);
      }

      const conversationHistory = extractConversationHistory(uiMessages);
      // O ciclo guiado responde pelas duas pontas: classifica o pedido novo e
      // continua de onde parou quando a mensagem é resposta a uma pergunta.
      const classified = await runGuidedAction({
        ctx: {
          userId,
          organizationId,
          route: parsed.context ?? {},
          sessionId,
          channel: "CHAT",
        } as never,
        text: lastUserText,
        history: conversationHistory,
        sessionId,
      });
      if (classified) {
        console.log(
          `[ASTRO/chat] camada ${classified.route} resolveu: ${classified.actionKey}`,
        );
        // RNF-4: o caminho barato também entra no registro de custo, senão a
        // economia fica invisível no relatório.
        const stakeRefusal = await chargePendingStake();
        if (stakeRefusal) return stakeRefusal;
        if (classified.tokensUsed > 0 && astroAiMode === "OWN") {
          void recordUsageEvent({
            organizationId,
            userId,
            kind: "LLM",
            action: "astro_tokens",
            appSlug: "astro",
            feature: "astro.classifier",
            usingCustomKey: true,
            tokens: { totalTokens: classified.tokensUsed },
            starsCharged: 0,
            sessionId,
            latencyMs: Date.now() - routingStartedAt,
            metadata: { route: classified.route, action: classified.actionKey },
          });
        } else if (classified.tokensUsed > 0) {
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
        }
        return classified.response;
      }
    }
  }

  // Spec 0053 (RF-2): pedido aberto sem IA escolhida pede a escolha, sem cobrar nada.
  if (astroAiMode === null) {
    return buildCardResponse(
      chatTurn,
      "choose_ai",
      {
        kind: "astro_choose_ai",
        platformModelLabel: "GPT-4o mini",
        retryText: extractLastUserText(uiMessages),
      } satisfies AstroChooseAiPayload,
      "Você precisa integrar sua IA ou escolher nosso modelo para deixar o Astro mais inteligente.",
    );
  }

  // Anexos declarados na última mensagem do usuário (spec 0014, D-3). O
  // arquivo já subiu pela rota REST; aqui só confirmamos que ele é desta
  // organização antes de deixar o modelo enxergar o id.
  const attachments = await resolveMessageAttachments(uiMessages, organizationId);

  const preferredModelOverride = isTrafegoScope
    ? null
    : await resolvePreferredModelOverride(organizationId, parsed.preferredModelId);
  let resolvedModel: { provider: string; modelId: string; usingCustomKey: boolean } | null = null;
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
      modelOverride:
        preferredModelOverride ??
        // Modelo ÓRBITA só força a OpenAI quando ela é a principal; com outra IA principal, vale a ordem do usuário.
        (astroAiMode === "PLATFORM" && !isTrafegoScope && (!parsed.providerOrder?.length || parsed.providerOrder[0] === "openai")
          ? ORBITA_PLATFORM_MODEL
          : undefined),
      providerOrder: isTrafegoScope ? undefined : parsed.providerOrder,
      disabledModelIds: isTrafegoScope ? undefined : parsed.disabledModelIds,
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
  let capturedTokenSplit: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } = {};

  return result.toUIMessageStreamResponse({
    // Sem o histórico de entrada, o onFinish recebe só a resposta nova e a sessão
    // salva perde as perguntas — o Histórico reabria conversas quase vazias.
    originalMessages: uiMessages,
    onError: (streamError) => {
      console.error("[ASTRO/chat] stream error", streamError);
      void reportAiQuotaExhausted({
        organizationId,
        usingCustomKey: (resolvedModel as { usingCustomKey: boolean } | null)?.usingCustomKey ?? false,
        source: "astro.chat",
        error: streamError,
        provider: (resolvedModel as { provider: string } | null)?.provider,
      });
      return describeStreamError(streamError);
    },
    // Anexa { tokens } na última mensagem do stream (event "finish" do AI SDK).
    // Cliente lê em `message.metadata.tokens` e renderiza no rodapé.
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        const usage = (part as {
          totalUsage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number; cachedInputTokens?: number };
        }).totalUsage;
        const tokens = usage?.totalTokens ?? 0;
        if (tokens > 0) {
          capturedTokens = tokens;
          // Entrada e saída separadas deixam o custo sair da tabela de preços, não de estimativa (spec 0055).
          capturedTokenSplit = {
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            cachedTokens: usage?.cachedInputTokens,
          };
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
      // Chave da própria org (RF-6): só a taxa fixa; os tokens ficam registrados a custo zero.
      const isUsingCustomKey =
        (resolvedModel as { usingCustomKey: boolean } | null)?.usingCustomKey ?? false;
      if (capturedTokens > 0 && !isTrafegoScope && isUsingCustomKey) {
        void recordUsageEvent({
          organizationId,
          userId,
          kind: "LLM",
          action: "astro_tokens",
          appSlug: "astro",
          feature: "astro.orchestrator",
          provider: resolvedModel?.provider,
          modelId: resolvedModel?.modelId,
          usingCustomKey: true,
          tokens: { totalTokens: capturedTokens, ...capturedTokenSplit },
          starsCharged: 0,
          sessionId,
          latencyMs: Date.now() - startedAt,
        });
      } else if (capturedTokens > 0 && !isTrafegoScope) {
        // Modelo escolhido pelo usuário na chave da plataforma: custo real do modelo + margem do admin (spec 0055, RF-12).
        const isChosenPlatformModel =
          preferredModelOverride?.isPlatformKey === true && resolvedModel?.modelId === preferredModelOverride.modelId;
        const chosenModelCharge = isChosenPlatformModel
          ? await computeChosenModelStars({
              provider: resolvedModel?.provider,
              modelId: resolvedModel?.modelId,
              totalTokens: capturedTokens,
              ...capturedTokenSplit,
            }).catch((pricingError) => {
              console.warn("[ASTRO/chat] preço do modelo escolhido falhou; cobrança padrão:", pricingError);
              return null;
            })
          : null;
        try {
          await meter({
            organizationId,
            action: "astro_tokens",
            userId,
            ...(chosenModelCharge
              ? { computedStars: { stars: chosenModelCharge.stars, computedBy: `astro-model-markup-${chosenModelCharge.markupPercent}pct` } }
              : {}),
            quantity: { unit: "token", amount: capturedTokens },
            appSlug: "astro",
            description: `Astro IA — ${capturedTokens.toLocaleString("pt-BR")} tokens`,
            feature: "astro.orchestrator",
            sessionId,
            cost: {
              kind: "LLM",
              provider: resolvedModel?.provider,
              modelId: resolvedModel?.modelId,
              tokens: { totalTokens: capturedTokens, ...capturedTokenSplit },
              latencyMs: Date.now() - startedAt,
            },
          });
        } catch (e) {
          // Saldo insuficiente etc. — só loga, não bloqueia a resposta
          // (já entregamos ao user). Próximo prompt vai falhar no stake.
          console.warn("[ASTRO/chat] token charge failed:", e);
        }
      }

      await persistSessionMessages(sessionId, finalMessages);
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
