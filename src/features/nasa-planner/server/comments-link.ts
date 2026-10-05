import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { socialRepositoriesForOrganization } from "@/modules/social";
import { setAutomationActive } from "@/modules/social/application/activate-automation";
import type { Automation, ReplyToCommentConfig, SendDirectMessageConfig } from "@/modules/social/domain/types";
import type { ChannelRepository } from "@/modules/social/ports/repositories";

/**
 * Comments nativo no post do Planner (spec 0059). A automação mora no Comments (SocialAutomation);
 * o Planner só guarda o vínculo e, quando o post sai, aponta a automação para o post publicado.
 */

const MAX_PUBLIC_REPLIES = 5;

export interface PlannerCommentsConfig {
  respondToAnyComment: boolean;
  keywords: string[];
  excludedKeywords: string[];
  directMessageText: string;
  buttonTitle?: string;
  buttonUrl?: string;
  publicReplies: string[];
  isActive: boolean;
}

function summarizeAutomation(automation: Automation) {
  const trigger = automation.triggers[0];
  const includeRules = trigger?.rules.filter((rule) => rule.kind === "INCLUDE") ?? [];
  const excludeRules = trigger?.rules.filter((rule) => rule.kind === "EXCLUDE") ?? [];
  const directMessage = trigger?.steps.find((step) => step.kind === "SEND_DIRECT_MESSAGE")?.config as SendDirectMessageConfig | undefined;
  const publicReply = trigger?.steps.find((step) => step.kind === "REPLY_TO_COMMENT")?.config as ReplyToCommentConfig | undefined;
  return {
    id: automation.id,
    name: automation.name,
    isActive: automation.isActive,
    targetScope: trigger?.targetScope ?? null,
    respondToAnyComment: includeRules.length === 0 || includeRules.some((rule) => rule.operator === "ANY_TEXT"),
    keywords: includeRules.filter((rule) => rule.operator !== "ANY_TEXT").flatMap((rule) => rule.terms),
    excludedKeywords: excludeRules.flatMap((rule) => rule.terms),
    directMessageText: directMessage?.text ?? "",
    usesAiMessage: directMessage?.source === "AI",
    buttonTitle: directMessage?.buttons[0]?.title ?? "",
    buttonUrl: directMessage?.buttons[0]?.url ?? "",
    publicReplies: publicReply?.variants ?? [],
  };
}

/**
 * A automação de um post mora na conta do Instagram **do post** (spec 0069, RF-19).
 * Post sem conta definida só resolve sozinho quando a organização tem uma conta só (CB-16).
 */
async function resolvePostChannel(channels: ChannelRepository, targetIgAccountId: string | null) {
  if (targetIgAccountId) {
    return { channel: await channels.findByExternalAccountId("INSTAGRAM", targetIgAccountId), needsAccountChoice: false };
  }
  const usableChannels = (await channels.listForTenant("INSTAGRAM")).filter((channel) => channel.status !== "DISABLED");
  if (usableChannels.length === 1) return { channel: usableChannels[0], needsAccountChoice: false };
  return { channel: null, needsAccountChoice: usableChannels.length > 1 };
}

export async function getPlannerCommentsStatus(postId: string) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    select: { organizationId: true, targetIgAccountId: true, externalIgPostId: true, commentsAutomationId: true, commentsAutoActivate: true },
  });
  const { channels, automations } = socialRepositoriesForOrganization(post.organizationId);
  const linkedAutomation = post.commentsAutomationId ? await automations.findById(post.commentsAutomationId) : null;
  const { channel, needsAccountChoice } = await resolvePostChannel(channels, post.targetIgAccountId);
  if (post.commentsAutomationId && !linkedAutomation) {
    // Apagada no Comments: o vínculo deixa de existir (spec 0059, CB-1).
    await prisma.nasaPlannerPost.update({ where: { id: postId }, data: { commentsAutomationId: null } });
  }
  // Automação criada quando o post apontava para outra conta (spec 0069, CB-17).
  const accountMismatch = Boolean(channel && linkedAutomation && linkedAutomation.channelId !== channel.id);
  const allPostsAutomations = channel
    ? (await automations.findActiveByChannel(channel.id))
        .filter((automation) => automation.id !== linkedAutomation?.id && automation.triggers.some((trigger) => trigger.targetScope === "ALL_CONTENT"))
        .map((automation) => ({ id: automation.id, name: automation.name }))
    : [];

  return {
    organizationId: post.organizationId,
    channel: channel
      ? { isConnected: true, isActive: channel.status === "ACTIVE", handle: channel.handle, accountMismatch, needsAccountChoice: false }
      : { isConnected: false, isActive: false, handle: null, accountMismatch: false, needsAccountChoice },
    isPublished: Boolean(post.externalIgPostId),
    autoActivateOnPublish: post.commentsAutoActivate,
    automation: linkedAutomation ? summarizeAutomation(linkedAutomation) : null,
    allPostsAutomations,
  };
}

function buildTriggerParts(config: PlannerCommentsConfig) {
  const keywords = config.keywords.map((keyword) => keyword.trim()).filter(Boolean);
  const excludedKeywords = config.excludedKeywords.map((keyword) => keyword.trim()).filter(Boolean);
  const rules = [
    config.respondToAnyComment || keywords.length === 0
      ? { kind: "INCLUDE" as const, operator: "ANY_TEXT" as const, terms: [] }
      : { kind: "INCLUDE" as const, operator: "CONTAINS" as const, terms: keywords },
    ...(excludedKeywords.length ? [{ kind: "EXCLUDE" as const, operator: "CONTAINS" as const, terms: excludedKeywords }] : []),
  ];
  const hasButton = Boolean(config.buttonTitle?.trim() && config.buttonUrl?.trim());
  const publicReplies = config.publicReplies.map((reply) => reply.trim()).filter(Boolean).slice(0, MAX_PUBLIC_REPLIES);
  const steps = [
    {
      kind: "SEND_DIRECT_MESSAGE" as const,
      order: 0,
      config: {
        source: "STATIC",
        text: config.directMessageText.trim(),
        buttons: hasButton ? [{ type: "URL", title: config.buttonTitle!.trim().slice(0, 20), url: config.buttonUrl!.trim() }] : [],
      } satisfies SendDirectMessageConfig,
    },
    ...(publicReplies.length
      ? [{ kind: "REPLY_TO_COMMENT" as const, order: 1, config: { variants: publicReplies, strategy: "RANDOM" } satisfies ReplyToCommentConfig }]
      : []),
  ];
  return { rules, steps };
}

export async function savePlannerCommentsAutomation(postId: string, actorId: string, config: PlannerCommentsConfig) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    select: { organizationId: true, title: true, targetIgAccountId: true, externalIgPostId: true, externalIgPermalink: true, caption: true, commentsAutomationId: true },
  });
  if (!config.directMessageText.trim()) throw new ORPCError("BAD_REQUEST", { message: "Escreva a mensagem que vai por DM." });

  const repositories = socialRepositoriesForOrganization(post.organizationId);
  const { channel, needsAccountChoice } = await resolvePostChannel(repositories.channels, post.targetIgAccountId);
  if (needsAccountChoice) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Escolha em qual conta do Instagram o post vai sair antes de configurar a automação." });
  }
  if (!channel) throw new ORPCError("PRECONDITION_FAILED", { message: "Conecte a conta do Instagram deste post nos Satélites para usar a automação." });

  const linkedAutomation = post.commentsAutomationId ? await repositories.automations.findById(post.commentsAutomationId) : null;
  // Automação de outra conta não é reaproveitada: nasce uma nova na conta do post (CB-17).
  const existingAutomation = linkedAutomation?.channelId === channel.id ? linkedAutomation : null;
  const automationId = existingAutomation?.id
    ?? (await repositories.automations.create({ channelId: channel.id, name: `Planner: ${post.title?.trim() || "post"}`.slice(0, 120), createdById: actorId })).id;

  const { rules, steps } = buildTriggerParts(config);
  await repositories.automations.upsertTrigger({
    automationId,
    triggerId: existingAutomation?.triggers[0]?.id,
    eventType: "COMMENT_CREATED",
    targetScope: "SPECIFIC_CONTENT",
    matchLogic: "ANY_RULE",
    targets: post.externalIgPostId
      ? [{ externalContentId: post.externalIgPostId, contentType: "OTHER", permalink: post.externalIgPermalink, caption: post.caption }]
      : [],
    rules,
    steps,
  });
  await prisma.nasaPlannerPost.update({
    where: { id: postId },
    data: { commentsAutomationId: automationId, commentsAutoActivate: config.isActive },
  });

  // Antes de publicar não há post para mirar: fica desligada e liga sozinha ao publicar (RF-4).
  const shouldBeActiveNow = config.isActive && Boolean(post.externalIgPostId);
  await setAutomationActive({ automationId, isActive: shouldBeActiveNow }, repositories);
  return getPlannerCommentsStatus(postId);
}

/** Chamado depois que o post sai no Instagram (spec 0057, `afterPublished`). Falha aqui não desfaz a publicação. */
export async function attachCommentsAutomationAfterPublish(postId: string) {
  const post = await prisma.nasaPlannerPost.findUnique({
    where: { id: postId },
    select: { organizationId: true, externalIgPostId: true, externalIgPermalink: true, caption: true, commentsAutomationId: true, commentsAutoActivate: true },
  });
  if (!post?.commentsAutomationId || !post.externalIgPostId) return;
  const repositories = socialRepositoriesForOrganization(post.organizationId);
  const automation = await repositories.automations.findById(post.commentsAutomationId);
  const trigger = automation?.triggers[0];
  if (!automation || !trigger) return;
  await repositories.automations.upsertTrigger({
    automationId: automation.id,
    triggerId: trigger.id,
    eventType: trigger.eventType,
    targetScope: "SPECIFIC_CONTENT",
    matchLogic: trigger.matchLogic,
    targets: [{ externalContentId: post.externalIgPostId, contentType: "OTHER", permalink: post.externalIgPermalink, caption: post.caption }],
    rules: trigger.rules.map((rule) => ({ kind: rule.kind, operator: rule.operator, terms: rule.terms })),
    steps: trigger.steps.map((step) => ({ kind: step.kind, order: step.order, config: step.config })),
  });
  if (post.commentsAutoActivate) {
    await setAutomationActive({ automationId: automation.id, isActive: true }, repositories);
  }
}
