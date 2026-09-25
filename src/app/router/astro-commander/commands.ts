import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { computeNextRun, isValidCron } from "@/features/astro-commander/lib/cron";
import { describeTrigger, parseCommandInstruction } from "@/features/astro-commander/server/parse-command";
import { runCommand } from "@/features/astro-commander/server/run-command";

/**
 * Comandos do ASTRO COMMANDER (spec 0023). A lista, o card do comando e o
 * card de revisão do widget consomem estas procedures.
 */

const personaEnum = z.enum(["SALES", "FINANCE", "ADMIN", "ACCOUNTING", "CUSTOM"]);
const triggerEnum = z.enum(["ONCE", "SCHEDULE", "EVENT"]);
const autonomyEnum = z.enum(["DRAFT", "APPROVE_ABOVE", "AUTO"]);
const statusEnum = z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);

const LIST_PAGE_SIZE = 50;

/** Campos que a lista precisa — o resto só na página do comando. */
const listSelect = {
  id: true,
  title: true,
  instruction: true,
  persona: true,
  status: true,
  autonomy: true,
  triggerType: true,
  cron: true,
  eventKey: true,
  timezone: true,
  modelId: true,
  iconUrl: true,
  nextRunAt: true,
  lastRunAt: true,
  updatedAt: true,
  pausedReason: true,
  maxRunsPerDay: true,
} as const;

/**
 * Quando o gatilho é por agenda, o próximo disparo é recalculado aqui. Deixar
 * isso para o tick faria o comando ficar um ciclo inteiro sem rodar.
 */
function resolveNextRunAt(params: {
  status: string;
  triggerType: string;
  cron?: string | null;
  runAt?: Date | null;
  timezone: string;
}): Date | null {
  if (params.status !== "ACTIVE") return null;
  if (params.triggerType === "SCHEDULE" && params.cron) {
    return computeNextRun(params.cron, params.timezone);
  }
  if (params.triggerType === "ONCE") return params.runAt ?? new Date();
  return null;
}

export const listCommands = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        search: z.string().trim().max(120).optional(),
        status: statusEnum.optional(),
        persona: personaEnum.optional(),
        includeTemplates: z.boolean().default(false),
      })
      .optional(),
  )
  .handler(async ({ context, input }) => {
    const commands = await prisma.astroCommand.findMany({
      where: {
        organizationId: context.org.id,
        isTemplate: input?.includeTemplates ? undefined : false,
        status: input?.status ?? { not: "ARCHIVED" },
        persona: input?.persona,
        ...(input?.search
          ? {
              OR: [
                { title: { contains: input.search, mode: "insensitive" as const } },
                { instruction: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: LIST_PAGE_SIZE,
      select: listSelect,
    });

    return {
      commands: commands.map((command) => ({
        ...command,
        triggerLabel: describeTrigger(
          command.triggerType,
          command.cron,
          command.eventKey,
        ),
      })),
    };
  });

export const getCommand = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ context, input }) => {
    const command = await prisma.astroCommand.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!command) throw new Error("Comando não encontrado");

    const [runsToday, pendingApprovals] = await Promise.all([
      prisma.astroCommandRun.count({
        where: {
          commandId: command.id,
          startedAt: { gte: startOfToday() },
          status: { notIn: ["SKIPPED", "SKIPPED_LIMIT"] },
        },
      }),
      prisma.astroPendingAction.count({
        where: {
          organizationId: context.org.id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      command: {
        ...command,
        approvalThreshold: command.approvalThreshold
          ? Number(command.approvalThreshold)
          : null,
        triggerLabel: describeTrigger(
          command.triggerType,
          command.cron,
          command.eventKey,
        ),
      },
      runsToday,
      pendingApprovals,
    };
  });

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Interpreta a frase do usuário sem salvar nada (RF-1). */
export const draftCommand = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ instruction: z.string().trim().min(5).max(2000) }))
  .handler(async ({ context, input }) => {
    const draft = await parseCommandInstruction({
      organizationId: context.org.id,
      instruction: input.instruction,
    });
    return { draft };
  });

export const createCommand = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      title: z.string().trim().min(3).max(80),
      instruction: z.string().trim().min(5).max(2000),
      persona: personaEnum.default("CUSTOM"),
      triggerType: triggerEnum.default("ONCE"),
      cron: z.string().trim().nullable().optional(),
      eventKey: z.string().trim().nullable().optional(),
      runAt: z.coerce.date().nullable().optional(),
      timezone: z.string().default("America/Sao_Paulo"),
      autonomy: autonomyEnum.default("DRAFT"),
      approvalThreshold: z.number().nonnegative().nullable().optional(),
      maxRunsPerDay: z.number().int().min(1).max(500).default(24),
      maxStarsPerRun: z.number().int().min(1).max(5000).default(200),
      toolScope: z.array(z.string()).default([]),
      status: statusEnum.default("DRAFT"),
    }),
  )
  .handler(async ({ context, input }) => {
    if (input.triggerType === "SCHEDULE" && (!input.cron || !isValidCron(input.cron))) {
      throw new Error("Agendamento inválido: informe um cron de 5 campos.");
    }
    if (input.triggerType === "EVENT" && !input.eventKey) {
      throw new Error("Gatilho por evento exige um evento.");
    }
    if (input.triggerType === "ONCE" && input.runAt && input.runAt.getTime() < Date.now()) {
      throw new Error("A data escolhida já passou. Use \"rodar agora\" ou escolha outra.");
    }

    const command = await prisma.astroCommand.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        title: input.title,
        instruction: input.instruction,
        persona: input.persona,
        triggerType: input.triggerType,
        cron: input.triggerType === "SCHEDULE" ? input.cron : null,
        eventKey: input.triggerType === "EVENT" ? input.eventKey : null,
        runAt: input.triggerType === "ONCE" ? (input.runAt ?? null) : null,
        timezone: input.timezone,
        autonomy: input.autonomy,
        approvalThreshold: input.approvalThreshold ?? null,
        maxRunsPerDay: input.maxRunsPerDay,
        maxStarsPerRun: input.maxStarsPerRun,
        toolScope: input.toolScope,
        status: input.status,
        nextRunAt: resolveNextRunAt({
          status: input.status,
          triggerType: input.triggerType,
          cron: input.cron,
          runAt: input.runAt,
          timezone: input.timezone,
        }),
      },
      select: listSelect,
    });

    return { command };
  });

export const updateCommand = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      title: z.string().trim().min(3).max(80).optional(),
      instruction: z.string().trim().min(5).max(2000).optional(),
      persona: personaEnum.optional(),
      triggerType: triggerEnum.optional(),
      cron: z.string().trim().nullable().optional(),
      eventKey: z.string().trim().nullable().optional(),
      runAt: z.coerce.date().nullable().optional(),
      timezone: z.string().optional(),
      autonomy: autonomyEnum.optional(),
      approvalThreshold: z.number().nonnegative().nullable().optional(),
      maxRunsPerDay: z.number().int().min(1).max(500).optional(),
      maxStarsPerRun: z.number().int().min(1).max(5000).optional(),
      modelId: z.string().nullable().optional(),
      systemPrompt: z.string().max(20000).nullable().optional(),
      greetingMessage: z.string().max(1000).nullable().optional(),
      vocabulary: z.array(z.string()).optional(),
      blockedWords: z.array(z.string()).optional(),
      knowledgeIds: z.array(z.string()).optional(),
      toolScope: z.array(z.string()).optional(),
      toolApprovals: z.record(z.string(), z.boolean()).optional(),
      connectedApps: z.record(z.string(), z.unknown()).optional(),
      voiceConfig: z.record(z.string(), z.unknown()).optional(),
      executionConfig: z.record(z.string(), z.unknown()).optional(),
      iconUrl: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const current = await prisma.astroCommand.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!current) throw new Error("Comando não encontrado");

    const triggerType = input.triggerType ?? current.triggerType;
    const cron = input.cron !== undefined ? input.cron : current.cron;
    const timezone = input.timezone ?? current.timezone;
    const eventKey = input.eventKey !== undefined ? input.eventKey : current.eventKey;
    const runAt = input.runAt !== undefined ? input.runAt : current.runAt;

    if (triggerType === "SCHEDULE" && (!cron || !isValidCron(cron))) {
      throw new Error("Agendamento inválido: informe um cron de 5 campos.");
    }
    if (triggerType === "EVENT" && !eventKey) {
      throw new Error("Gatilho por evento exige um evento.");
    }

    const { id, ...fields } = input;
    const command = await prisma.astroCommand.update({
      where: { id },
      data: {
        ...fields,
        approvalThreshold: input.approvalThreshold ?? undefined,
        toolApprovals: input.toolApprovals as object | undefined,
        connectedApps: input.connectedApps as object | undefined,
        voiceConfig: input.voiceConfig as object | undefined,
        executionConfig: input.executionConfig as object | undefined,
        cron: triggerType === "SCHEDULE" ? cron : null,
        eventKey: triggerType === "EVENT" ? eventKey : null,
        runAt: triggerType === "ONCE" ? runAt : null,
        nextRunAt: resolveNextRunAt({
          status: current.status,
          triggerType,
          cron,
          runAt,
          timezone,
        }),
      },
      select: listSelect,
    });

    return { command };
  });

/** Pausar, retomar, ativar e arquivar — a mesma transição, um lugar só. */
export const setCommandStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), status: statusEnum }))
  .handler(async ({ context, input }) => {
    const current = await prisma.astroCommand.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!current) throw new Error("Comando não encontrado");

    const command = await prisma.astroCommand.update({
      where: { id: input.id },
      data: {
        status: input.status,
        pausedReason: input.status === "PAUSED" ? "Pausado pelo usuário." : null,
        nextRunAt: resolveNextRunAt({
          status: input.status,
          triggerType: current.triggerType,
          cron: current.cron,
          runAt: current.runAt,
          timezone: current.timezone,
        }),
      },
      select: listSelect,
    });

    return { command };
  });

/** "Rodar agora" e "Testar comando" (RF-26). */
export const runCommandNow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), test: z.boolean().default(false) }))
  .handler(async ({ context, input }) => {
    const command = await prisma.astroCommand.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!command) throw new Error("Comando não encontrado");

    // Teste responde na hora (o usuário está olhando o painel); "rodar agora"
    // vai para a fila, que é onde mora o limite de concorrência por org.
    if (input.test) {
      return runCommand({
        commandId: command.id,
        trigger: "TEST",
        actorUserId: context.user.id,
      });
    }

    await inngest.send({
      name: "astro/command.run",
      data: {
        commandId: command.id,
        organizationId: context.org.id,
        trigger: "MANUAL",
        actorUserId: context.user.id,
      },
    });
    return { runId: null, status: "RUNNING" as const, summary: "Execução enfileirada." };
  });

/** Botão "pausar tudo" da organização (RF-7). */
export const setOrgPaused = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ paused: z.boolean() }))
  .handler(async ({ context, input }) => {
    await prisma.organization.update({
      where: { id: context.org.id },
      data: { astroCommanderPausedAt: input.paused ? new Date() : null },
    });
    return { paused: input.paused };
  });
