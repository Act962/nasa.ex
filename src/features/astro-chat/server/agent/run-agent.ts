import "server-only";
import { generateText, type ModelMessage } from "ai";
import { v4 as uuidv4 } from "uuid";
import type { GetStepTools } from "inngest";
import prisma from "@/lib/prisma";
import type { inngest } from "@/inngest/client";
import { resolveModel } from "@/features/tracking-chat-ai/lib/model";
import { persistOutboundMessage } from "@/features/tracking-chat-ai/lib/persist";
import {
  buildKnowledgeBlock,
  loadKnowledgeDocuments,
  type KnowledgeDocument,
} from "@/features/astro/server/knowledge/load-knowledge";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { recordUsageEvent } from "@/features/stars/lib/metering";
import { ASTRO_CHAT_AI_ACTION, HUMAN_TAKEOVER_SILENCE_MS } from "../../lib/constants";
import { buildRestrictionsBlock } from "../../lib/data-topics";
import { reserveDailyAiReply } from "../rate-limit";
import { buildPublicAgentPrompt } from "./system-prompt";
import { buildPublicAgentTools } from "./tools";

/** Resposta do ASTRO público a um visitante do site (spec 0031, RF-7 a RF-9). */

type Step = GetStepTools<typeof inngest>;

export type AstroChatAgentEvent = {
  siteId: string;
  organizationId: string;
  trackingId: string;
  leadId: string;
  conversationId: string;
  visitorId: string;
};

const HISTORY_LIMIT = 20;
const TEAM_FALLBACK_TEXT = "Recebi sua mensagem! Em instantes alguém da nossa equipe te responde por aqui.";
const HANDOFF_TEXT = "Vou chamar alguém da nossa equipe para continuar com você por aqui. É rapidinho!";

async function sendAstroMessage(params: {
  event: AstroChatAgentEvent;
  body: string;
  senderName: string;
}) {
  await persistOutboundMessage({
    conversationId: params.event.conversationId,
    leadId: params.event.leadId,
    trackingId: params.event.trackingId,
    body: params.body,
    senderName: params.senderName,
    externalMessageId: `astrochat-ai-${uuidv4()}`,
    metadata: { astroChatAi: true },
  });
}

function toModelHistory(
  rows: { body: string | null; fromMe: boolean }[],
): ModelMessage[] {
  return rows
    .filter((row) => row.body?.trim())
    .map((row) => ({
      role: row.fromMe ? ("assistant" as const) : ("user" as const),
      content: row.body!.trim(),
    }));
}

type AgentContextSnapshot =
  | { skipReason: string }
  | {
      skipReason: null;
      assistantName: string;
      aiEnabled: boolean;
      instructions: string | null;
      knowledgeIds: string[];
      restrictions: string;
      companyName: string;
      companyNiche: string | null;
      companyPhone: string | null;
      hasContact: boolean;
      isFinished: boolean;
      history: { body: string | null; fromMe: boolean }[];
      hasAnyReply: boolean;
      lastReplyBody: string | null;
      lastVisitorText: string;
    };

/**
 * Tudo que decide a execução fica neste step: o Inngest reexecuta a função a
 * cada step, e reler o banco fora dele mudaria a decisão no meio (ex.: ver a
 * própria resposta como última mensagem).
 */
async function loadAgentContext(event: AstroChatAgentEvent): Promise<AgentContextSnapshot> {
  const site = await prisma.astroChatSite.findUnique({
    where: { id: event.siteId },
    select: {
      isEnabled: true,
      pausedReason: true,
      aiEnabled: true,
      assistantName: true,
      instructions: true,
      knowledgeIds: true,
      blockedTopicIds: true,
      restrictionNotes: true,
      organization: {
        select: {
          name: true,
          companyNiche: true,
          whatsappInstances: { select: { phoneNumber: true }, take: 1 },
        },
      },
    },
  });
  if (!site || !site.isEnabled || site.pausedReason) return { skipReason: "site_off" };

  const lead = await prisma.lead.findUnique({
    where: { id: event.leadId },
    select: { isActive: true, statusFlow: true, phone: true, email: true },
  });
  if (!lead) return { skipReason: "lead_missing" };
  if (!lead.isActive) return { skipReason: "transferred_to_team" };

  const recentMessages = await prisma.message.findMany({
    where: { conversationId: event.conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { body: true, fromMe: true, senderId: true, createdAt: true },
  });
  const lastMessage = recentMessages[0];
  if (!lastMessage || lastMessage.fromMe) return { skipReason: "nothing_to_answer" };

  const lastHumanReply = recentMessages.find((message) => message.fromMe && message.senderId);
  if (lastHumanReply && Date.now() - lastHumanReply.createdAt.getTime() < HUMAN_TAKEOVER_SILENCE_MS) {
    return { skipReason: "team_is_answering" };
  }

  return {
    skipReason: null,
    assistantName: site.assistantName,
    aiEnabled: site.aiEnabled,
    instructions: site.instructions,
    knowledgeIds: site.knowledgeIds,
    restrictions: buildRestrictionsBlock({
      blockedTopicIds: site.blockedTopicIds,
      restrictionNotes: site.restrictionNotes,
    }),
    companyName: site.organization.name,
    companyNiche: site.organization.companyNiche,
    companyPhone: site.organization.whatsappInstances[0]?.phoneNumber ?? null,
    hasContact: !!(lead.phone || lead.email),
    isFinished: lead.statusFlow === "FINISHED",
    history: [...recentMessages].reverse().map((message) => ({ body: message.body, fromMe: message.fromMe })),
    hasAnyReply: recentMessages.some((message) => message.fromMe),
    lastReplyBody: recentMessages.find((message) => message.fromMe)?.body ?? null,
    lastVisitorText: lastMessage.body?.trim() ?? "",
  };
}

export async function runAstroChatAgent({ step, event }: { step: Step; event: AstroChatAgentEvent }) {
  const context = await step.run("load-context", () => loadAgentContext(event));
  if (context.skipReason !== null) return { skipped: true, reason: context.skipReason };

  const replyWithTeamFallbackOnce = async (reason: string) => {
    if (context.lastReplyBody !== TEAM_FALLBACK_TEXT) {
      await step.run("send-team-fallback", () =>
        sendAstroMessage({ event, body: TEAM_FALLBACK_TEXT, senderName: context.assistantName }),
      );
    }
    return { skipped: true, reason };
  };

  if (!context.aiEnabled) {
    return context.hasAnyReply ? { skipped: true, reason: "ai_off" } : replyWithTeamFallbackOnce("ai_off");
  }

  if (context.isFinished) {
    await step.run("reopen-conversation", () =>
      prisma.lead.update({ where: { id: event.leadId }, data: { statusFlow: "ACTIVE" }, select: { id: true } }),
    );
  }

  // Em step: cobrança fora dele se repetiria a cada reexecução.
  const quota = await step.run("reserve-and-charge", async () => {
    if (!(await reserveDailyAiReply(event.siteId))) return "daily_limit" as const;
    const charge = await chargeStarsByAction(event.organizationId, ASTRO_CHAT_AI_ACTION, {
      description: "ASTRO CHAT — resposta IA no site",
      appSlug: "astro-chat",
    });
    return charge.success ? ("ok" as const) : ("stars_insufficient" as const);
  });
  if (quota !== "ok") return replyWithTeamFallbackOnce(quota);

  const knowledgeDocuments: KnowledgeDocument[] = await step.run("load-knowledge", () =>
    loadKnowledgeDocuments({
      organizationId: event.organizationId,
      knowledgeIds: context.knowledgeIds,
    }),
  );

  const system = buildPublicAgentPrompt({
    assistantName: context.assistantName,
    companyName: context.companyName,
    companyNiche: context.companyNiche,
    companyPhone: context.companyPhone,
    siteInstructions: context.instructions,
    restrictions: context.restrictions,
    knowledge: buildKnowledgeBlock(knowledgeDocuments),
    hasContact: context.hasContact,
    nowLabel: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  });

  const resolvedModel = resolveModel(null);
  const agentResult = await step.run("run-public-agent", async () => {
    const result = await generateText({
      model: resolvedModel.model,
      system,
      tools: buildPublicAgentTools({
        organizationId: event.organizationId,
        trackingId: event.trackingId,
        leadId: event.leadId,
        conversationId: event.conversationId,
      }),
      messages: toModelHistory(context.history),
      stopWhen: ({ steps }) => steps.length >= 4,
    });
    return {
      text: result.text.trim(),
      toolNames: result.steps.flatMap((agentStep) => agentStep.toolCalls.map((toolCall) => toolCall.toolName)),
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    };
  });

  await step.run("record-usage", () =>
    recordUsageEvent({
      organizationId: event.organizationId,
      kind: "LLM",
      action: ASTRO_CHAT_AI_ACTION,
      appSlug: "astro-chat",
      feature: "astro-chat.public-agent",
      modelId: resolvedModel.modelId,
      tokens: {
        inputTokens: agentResult.inputTokens,
        outputTokens: agentResult.outputTokens,
        totalTokens: agentResult.totalTokens,
      },
      trackingId: event.trackingId,
      leadId: event.leadId,
    }),
  );

  // Transferiu sem escrever: o visitante não pode ficar no silêncio.
  const hasTransferred = agentResult.toolNames.includes("transfer_to_human");
  const replyText = agentResult.text || (hasTransferred ? HANDOFF_TEXT : "");
  if (replyText) {
    await step.run("send-reply", () =>
      sendAstroMessage({ event, body: replyText, senderName: context.assistantName }),
    );
  }
  return { ok: true, replied: !!replyText, toolNames: agentResult.toolNames };
}
