import { ORPCError } from "@orpc/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { setAutomationActive } from "@/modules/social/application/activate-automation";
import { findReadinessIssues } from "@/modules/social/domain/automation-readiness";
import {
  replyToCommentConfigSchema,
  sendDirectMessageConfigSchema,
} from "@/modules/social/infra/schemas";
import { commentsProcedure, repositoriesFor, withDomainErrors } from "./_shared";

const stepSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SEND_DIRECT_MESSAGE"),
    order: z.number().int().min(0).default(0),
    config: sendDirectMessageConfigSchema,
  }),
  z.object({
    kind: z.literal("REPLY_TO_COMMENT"),
    order: z.number().int().min(0).default(1),
    config: replyToCommentConfigSchema,
  }),
]);

const ruleSchema = z.object({
  kind: z.enum(["INCLUDE", "EXCLUDE"]),
  operator: z.enum(["ANY_TEXT", "CONTAINS", "EXACT", "STARTS_WITH"]),
  terms: z.array(z.string().trim().min(1)).max(50).default([]),
});

const targetSchema = z.object({
  externalContentId: z.string().min(1),
  contentType: z
    .enum(["IMAGE", "VIDEO", "CAROUSEL", "REEL", "STORY", "OTHER"])
    .default("OTHER"),
  permalink: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
});

export const listAutomations = commentsProcedure
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { automations } = repositoriesFor(context.org.id);
    return automations.list();
  });

export const getAutomation = commentsProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const { automations } = repositoriesFor(context.org.id);
    const automation = await automations.findById(input.id);

    if (!automation) {
      throw new ORPCError("NOT_FOUND", { message: "Automação não encontrada" });
    }

    return { ...automation, issues: findReadinessIssues(automation) };
  });

export const createAutomation = commentsProcedure
  .input(z.object({ name: z.string().trim().max(120).optional() }))
  .handler(async ({ context, input }) => {
    const { automations, channels } = repositoriesFor(context.org.id);
    const channel = await channels.findForTenant();

    if (!channel) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Conecte uma conta do Instagram antes de criar automações.",
      });
    }

    return automations.create({
      channelId: channel.id,
      name: input.name?.trim() || "Sem título",
      createdById: context.user.id,
    });
  });

export const renameAutomation = commentsProcedure
  .input(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(120) }))
  .handler(async ({ context, input }) =>
    withDomainErrors(async () => {
      const { automations } = repositoriesFor(context.org.id);
      await automations.rename(input.id, input.name);
      return { renamed: true };
    }),
  );

export const setActiveAutomation = commentsProcedure
  .input(z.object({ id: z.string().min(1), isActive: z.boolean() }))
  .handler(async ({ context, input }) =>
    withDomainErrors(async () => {
      const { automations, channels } = repositoriesFor(context.org.id);
      await setAutomationActive(
        { automationId: input.id, isActive: input.isActive },
        { automations, channels },
      );
      return { isActive: input.isActive };
    }),
  );

export const deleteAutomation = commentsProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const { automations } = repositoriesFor(context.org.id);
    await automations.remove(input.id);
    return { deleted: true };
  });

/**
 * Salva o gatilho inteiro — alvos, regras e passos de uma vez.
 *
 * O painel do editor edita o conjunto; gravar por partes abriria janela para
 * automação ativa com resposta pela metade (spec 0024 CB-9).
 */
export const saveTrigger = commentsProcedure
  .input(
    z.object({
      automationId: z.string().min(1),
      triggerId: z.string().optional(),
      eventType: z.enum(["COMMENT_CREATED", "DIRECT_MESSAGE_RECEIVED"]),
      targetScope: z
        .enum(["ALL_CONTENT", "SPECIFIC_CONTENT", "NEXT_CONTENT"])
        .default("ALL_CONTENT"),
      matchLogic: z.enum(["ANY_RULE", "ALL_RULES"]).default("ANY_RULE"),
      targets: z.array(targetSchema).max(50).default([]),
      rules: z.array(ruleSchema).max(20).default([]),
      steps: z.array(stepSchema).max(10).default([]),
    }),
  )
  .handler(async ({ context, input }) =>
    withDomainErrors(async () => {
      const { automations } = repositoriesFor(context.org.id);
      return automations.upsertTrigger(input);
    }),
  );

export const deleteTrigger = commentsProcedure
  .input(z.object({ automationId: z.string().min(1), triggerId: z.string().min(1) }))
  .handler(async ({ context, input }) =>
    withDomainErrors(async () => {
      const { automations } = repositoriesFor(context.org.id);
      await automations.removeTrigger(input.automationId, input.triggerId);
      return { deleted: true };
    }),
  );

/** Últimas execuções — é o que responde "por que não respondeu?". */
export const listRuns = commentsProcedure
  .input(
    z.object({
      automationId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ context, input }) => {
    const runs = await prisma.socialAutomationRun.findMany({
      where: {
        automation: { organizationId: context.org.id },
        ...(input.automationId ? { automationId: input.automationId } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        status: true,
        error: true,
        startedAt: true,
        finishedAt: true,
        automation: { select: { id: true, name: true } },
        contact: { select: { username: true, externalUserId: true } },
        stepRuns: {
          select: { kind: true, status: true, error: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return runs;
  });
