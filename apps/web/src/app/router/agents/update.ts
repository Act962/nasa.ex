import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { agentSpecSchema } from "@/features/auto-agent/lib/agent-spec.schema";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Atualiza campos do agente. `isActive` aceita toggle individual; quando
 * vira true, dispara evento `auto-agent/session-scheduled` pra cada lead
 * relevante (a integrar na Fase 2 com Inngest).
 *
 * Mudança em `spec` revalida via Zod. Mudança em `followUpSchedule` ou
 * `maxAttempts` NÃO retroage em sessões já WAITING — só vale pra próximas.
 */
export const updateAgent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    path: "/agents/:id",
    summary: "Atualiza agente IA",
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      rawPrompt: z.string().min(1).optional(),
      systemInstructions: z.string().optional(),
      spec: z.any().optional(),
      mode: z.enum(["AUTO", "SEMI", "MANUAL"]).optional(),
      isActive: z.boolean().optional(),
      followUpSchedule: z.array(z.number().int().positive()).optional(),
      maxAttempts: z.number().int().positive().optional(),
      maxStarsPerLead: z.number().int().positive().optional(),
      cooldownMinutes: z.number().int().nonnegative().optional(),
      stopWords: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    const existing = await prisma.agent.findFirst({
      where: { id: input.id, organizationId: org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Agente não encontrado" });
    }

    const data: Prisma.AgentUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.rawPrompt !== undefined) data.rawPrompt = input.rawPrompt;
    if (input.systemInstructions !== undefined)
      data.systemInstructions = input.systemInstructions;
    if (input.mode !== undefined) data.mode = input.mode;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.followUpSchedule !== undefined)
      data.followUpSchedule = input.followUpSchedule;
    if (input.maxAttempts !== undefined) data.maxAttempts = input.maxAttempts;
    if (input.maxStarsPerLead !== undefined)
      data.maxStarsPerLead = input.maxStarsPerLead;
    if (input.cooldownMinutes !== undefined)
      data.cooldownMinutes = input.cooldownMinutes;
    if (input.stopWords !== undefined) data.stopWords = input.stopWords;

    if (input.spec !== undefined) {
      const parsed = agentSpecSchema.safeParse(input.spec);
      if (!parsed.success) {
        throw errors.BAD_REQUEST({
          message: `Spec inválido: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        });
      }
      data.spec = parsed.data as unknown as Prisma.InputJsonValue;
    }

    const updated = await prisma.agent.update({
      where: { id: input.id },
      data,
      select: { id: true, name: true, isActive: true },
    });

    return updated;
  });
