import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { agentSpecSchema } from "@/features/auto-agent/lib/agent-spec.schema";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Cria um agente novo. Spec já deve vir validado (UI roda generate-spec +
 * validateGeneratedSpec antes de enviar). Validamos de novo aqui defensivo.
 *
 * `isActive` default false — user precisa explicitamente ativar depois.
 */
export const createAgent = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/agents",
    summary: "Cria agente IA autônomo",
  })
  .input(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      trackingId: z.string().optional(),
      rawPrompt: z.string().min(1),
      systemInstructions: z.string().default(""),
      spec: z.any(), // validamos via agentSpecSchema abaixo
      mode: z.enum(["AUTO", "SEMI", "MANUAL"]).default("AUTO"),
      followUpSchedule: z
        .array(z.number().int().positive())
        .default([1, 3, 5, 7]),
      maxAttempts: z.number().int().positive().default(4),
      maxStarsPerLead: z.number().int().positive().default(50),
      cooldownMinutes: z.number().int().nonnegative().default(30),
      stopWords: z
        .array(z.string())
        .default(["não quero", "remover", "sair", "spam", "parar", "stop"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { user, org } = context;

    // Valida spec defensivo
    const parsed = agentSpecSchema.safeParse(input.spec);
    if (!parsed.success) {
      throw errors.BAD_REQUEST({
        message: `Spec inválido: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      });
    }

    // Valida trackingId pertence à org (se passou)
    if (input.trackingId) {
      const t = await prisma.tracking.findFirst({
        where: { id: input.trackingId, organizationId: org.id },
        select: { id: true },
      });
      if (!t) {
        throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
      }
    }

    const created = await prisma.agent.create({
      data: {
        organizationId: org.id,
        trackingId: input.trackingId ?? null,
        name: input.name,
        description: input.description,
        rawPrompt: input.rawPrompt,
        systemInstructions: input.systemInstructions,
        spec: parsed.data as unknown as Prisma.InputJsonValue,
        mode: input.mode,
        isActive: false,
        followUpSchedule: input.followUpSchedule,
        maxAttempts: input.maxAttempts,
        maxStarsPerLead: input.maxStarsPerLead,
        cooldownMinutes: input.cooldownMinutes,
        stopWords: input.stopWords,
        createdById: user.id,
      },
      select: { id: true, name: true },
    });

    try {
      await logActivity({
        organizationId: org.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: (user as any).image,
        appSlug: "tracking",
        action: "agent_created",
        actionLabel: `Criou agente IA "${created.name}"`,
        resource: created.name,
        resourceId: created.id,
      });
    } catch (e) {
      console.warn("[agents.create] log activity failed:", e);
    }

    return { id: created.id, name: created.name };
  });
