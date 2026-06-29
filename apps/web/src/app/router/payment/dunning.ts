/**
 * Procedures de Régua de Cobrança (Fase 2).
 *
 * Modelo event-driven (sem cron unconditional) — quando entry recebe `dunningRuleId`,
 * `scheduleDunningForEntry` envia eventos Inngest delay-agendados. Idempotência
 * garantida via `PaymentDunningExecution.@@unique([entryId, stepId])`.
 *
 * Procedures:
 *   - rules.list / rules.create / rules.update / rules.delete
 *   - steps.create / steps.update / steps.delete
 *   - entries.assignRule (atribui régua a entry existente + re-agenda eventos)
 *   - executions.listByEntry (histórico de envios)
 */

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { scheduleDunningForEntry } from "@/features/payment/server/dunning/schedule";

const channelEnum = z.enum(["EMAIL", "WHATSAPP", "SMS"]);

const stepShape = z.object({
  id:              z.string(),
  ruleId:          z.string(),
  order:           z.number(),
  daysOffset:      z.number(),
  channel:         channelEnum,
  templateSubject: z.string().nullable(),
  templateBody:    z.string(),
  enabled:         z.boolean(),
});

const ruleShape = z.object({
  id:             z.string(),
  organizationId: z.string(),
  name:           z.string(),
  isActive:       z.boolean(),
  isDefault:      z.boolean(),
  createdAt:      z.date(),
  updatedAt:      z.date(),
  steps:          z.array(stepShape),
});

// ── Rules CRUD ──────────────────────────────────────────────────────────────

export const listDunningRules = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List dunning rules of the active org", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({ rules: z.array(ruleShape) }))
  .handler(async ({ context }) => {
    const rules = await prisma.paymentDunningRule.findMany({
      where: { organizationId: context.org.id },
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return { rules };
  });

export const createDunningRule = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create dunning rule", tags: ["Payment"] })
  .input(z.object({
    name:      z.string().min(1).max(80),
    isDefault: z.boolean().default(false),
    // Steps opcionais no momento da criação — podem ser adicionados depois.
    steps: z.array(z.object({
      order:           z.number().int().min(0).default(0),
      daysOffset:      z.number().int().min(-30).max(60),
      channel:         channelEnum,
      templateSubject: z.string().max(200).optional(),
      templateBody:    z.string().min(1).max(2000),
      enabled:         z.boolean().default(true),
    })).optional().default([]),
  }))
  .output(z.object({ rule: ruleShape }))
  .handler(async ({ input, context }) => {
    // Garante apenas 1 rule default por org.
    if (input.isDefault) {
      await prisma.paymentDunningRule.updateMany({
        where: { organizationId: context.org.id, isDefault: true },
        data:  { isDefault: false },
      });
    }
    const rule = await prisma.paymentDunningRule.create({
      data: {
        organizationId: context.org.id,
        name:           input.name,
        isDefault:      input.isDefault,
        isActive:       false, // nascer desligada — user revisa antes de ativar.
        steps: input.steps.length > 0 ? {
          create: input.steps.map((s, i) => ({
            order:           s.order ?? i,
            daysOffset:      s.daysOffset,
            channel:         s.channel,
            templateSubject: s.templateSubject ?? null,
            templateBody:    s.templateBody,
            enabled:         s.enabled,
          })),
        } : undefined,
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "payment",
      subAppSlug: "payment-dunning",
      featureKey: "payment.dunning.rule_created",
      action: "payment.dunning.rule_created",
      actionLabel: `Criou régua de cobrança "${rule.name}"`,
      resource: rule.name,
      resourceId: rule.id,
      metadata: { steps: input.steps.length },
    });
    return { rule };
  });

export const updateDunningRule = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Update dunning rule", tags: ["Payment"] })
  .input(z.object({
    id:        z.string(),
    name:      z.string().min(1).max(80).optional(),
    isActive:  z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }))
  .output(z.object({ rule: ruleShape }))
  .handler(async ({ input, context }) => {
    const existing = await prisma.paymentDunningRule.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Régua não encontrada" });

    if (input.isDefault === true) {
      await prisma.paymentDunningRule.updateMany({
        where: {
          organizationId: context.org.id,
          isDefault:      true,
          NOT:            { id: input.id },
        },
        data: { isDefault: false },
      });
    }

    const rule = await prisma.paymentDunningRule.update({
      where: { id: input.id },
      data:  {
        ...(input.name      !== undefined ? { name: input.name } : {}),
        ...(input.isActive  !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    return { rule };
  });

export const deleteDunningRule = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Delete dunning rule", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const rule = await prisma.paymentDunningRule.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!rule) throw new ORPCError("NOT_FOUND", { message: "Régua não encontrada" });
    // PaymentEntry.dunningRuleId vira null por causa do onDelete: SetNull.
    await prisma.paymentDunningRule.delete({ where: { id: input.id } });
    return { success: true };
  });

// ── Steps CRUD ─────────────────────────────────────────────────────────────

export const createDunningStep = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Add step to dunning rule", tags: ["Payment"] })
  .input(z.object({
    ruleId:          z.string(),
    order:           z.number().int().min(0).default(0),
    daysOffset:      z.number().int().min(-30).max(60),
    channel:         channelEnum,
    templateSubject: z.string().max(200).optional(),
    templateBody:    z.string().min(1).max(2000),
    enabled:         z.boolean().default(true),
  }))
  .output(z.object({ step: stepShape }))
  .handler(async ({ input, context }) => {
    const rule = await prisma.paymentDunningRule.findFirst({
      where: { id: input.ruleId, organizationId: context.org.id },
    });
    if (!rule) throw new ORPCError("NOT_FOUND", { message: "Régua não encontrada" });

    const step = await prisma.paymentDunningStep.create({
      data: {
        ruleId:          input.ruleId,
        order:           input.order,
        daysOffset:      input.daysOffset,
        channel:         input.channel,
        templateSubject: input.templateSubject ?? null,
        templateBody:    input.templateBody,
        enabled:         input.enabled,
      },
    });
    return { step };
  });

export const updateDunningStep = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Update dunning step", tags: ["Payment"] })
  .input(z.object({
    id:              z.string(),
    order:           z.number().int().min(0).optional(),
    daysOffset:      z.number().int().min(-30).max(60).optional(),
    channel:         channelEnum.optional(),
    templateSubject: z.string().max(200).nullable().optional(),
    templateBody:    z.string().min(1).max(2000).optional(),
    enabled:         z.boolean().optional(),
  }))
  .output(z.object({ step: stepShape }))
  .handler(async ({ input, context }) => {
    const step = await prisma.paymentDunningStep.findUnique({
      where: { id: input.id },
      include: { rule: { select: { organizationId: true } } },
    });
    if (!step || step.rule.organizationId !== context.org.id) {
      throw new ORPCError("NOT_FOUND", { message: "Step não encontrado" });
    }
    const updated = await prisma.paymentDunningStep.update({
      where: { id: input.id },
      data: {
        ...(input.order           !== undefined ? { order: input.order } : {}),
        ...(input.daysOffset      !== undefined ? { daysOffset: input.daysOffset } : {}),
        ...(input.channel         !== undefined ? { channel: input.channel } : {}),
        ...(input.templateSubject !== undefined ? { templateSubject: input.templateSubject } : {}),
        ...(input.templateBody    !== undefined ? { templateBody: input.templateBody } : {}),
        ...(input.enabled         !== undefined ? { enabled: input.enabled } : {}),
      },
    });
    return { step: updated };
  });

export const deleteDunningStep = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Delete dunning step", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const step = await prisma.paymentDunningStep.findUnique({
      where: { id: input.id },
      include: { rule: { select: { organizationId: true } } },
    });
    if (!step || step.rule.organizationId !== context.org.id) {
      throw new ORPCError("NOT_FOUND", { message: "Step não encontrado" });
    }
    await prisma.paymentDunningStep.delete({ where: { id: input.id } });
    return { success: true };
  });

// ── Assign rule to existing entry (re-schedule events) ─────────────────────

export const assignDunningRuleToEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Assign or remove dunning rule of a payment entry", tags: ["Payment"] })
  .input(z.object({
    entryId:       z.string(),
    dunningRuleId: z.string().nullable(),
  }))
  .output(z.object({ scheduled: z.number() }))
  .handler(async ({ input, context }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.entryId, organizationId: context.org.id },
      select: { id: true, type: true },
    });
    if (!entry) throw new ORPCError("NOT_FOUND", { message: "Lançamento não encontrado" });
    if (entry.type !== "RECEIVABLE") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Régua de cobrança só se aplica a contas a RECEBER",
      });
    }
    if (input.dunningRuleId) {
      const rule = await prisma.paymentDunningRule.findFirst({
        where: { id: input.dunningRuleId, organizationId: context.org.id },
      });
      if (!rule) throw new ORPCError("NOT_FOUND", { message: "Régua não encontrada" });
    }

    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data:  { dunningRuleId: input.dunningRuleId },
    });

    const result = input.dunningRuleId
      ? await scheduleDunningForEntry(entry.id)
      : { scheduled: 0, reason: "no-rule" as const };

    return { scheduled: result.scheduled };
  });

// ── Executions list (histórico) ────────────────────────────────────────────

export const listDunningExecutionsByEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List dunning executions for an entry", tags: ["Payment"] })
  .input(z.object({ entryId: z.string() }))
  .output(z.object({
    executions: z.array(z.object({
      id:           z.string(),
      stepId:       z.string(),
      scheduledFor: z.date(),
      executedAt:   z.date().nullable(),
      status:       z.enum(["PENDING", "SENT", "FAILED", "SKIPPED"]),
      channel:      channelEnum,
      errorMessage: z.string().nullable(),
      messageId:    z.string().nullable(),
    })),
  }))
  .handler(async ({ input, context }) => {
    // Confirma que a entry é da org do user antes de listar
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.entryId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!entry) throw new ORPCError("NOT_FOUND", { message: "Lançamento não encontrado" });

    const executions = await prisma.paymentDunningExecution.findMany({
      where: { entryId: input.entryId },
      orderBy: { scheduledFor: "desc" },
    });
    return { executions };
  });
