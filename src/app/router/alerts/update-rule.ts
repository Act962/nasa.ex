import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import {
  AUDIENCE_KINDS,
  getAlertEvent,
} from "@/features/alerts/lib/alert-catalog";
import { userIsOrgAdmin } from "@/features/astro/server/tools/_shared/permissions";
import {
  isDisplaySurface,
  isSeverity,
  resolveDisplaySurface,
} from "@/features/alerts/lib/severity";

/**
 * Atualiza campos de uma AlertRule existente.
 *
 * Suporta:
 *   - Toggle on/off (`isActive`).
 *   - Renomear / mudar descrição.
 *   - Mexer params (validados contra paramsSchema do evento).
 *   - Trocar severity / displaySurface / channels / audience / cooldown.
 *
 * Permissão: admin/owner OU criador da regra.
 */
export const updateAlertRule = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/alerts/update-rule",
    summary: "Atualiza uma regra de alerta",
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(3).max(80).optional(),
      description: z.string().nullable().optional(),
      params: z.record(z.string(), z.unknown()).optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      audience: z
        .object({
          kind: z.enum(AUDIENCE_KINDS),
          userIds: z.array(z.string()).optional(),
        })
        .optional(),
      channels: z.array(z.enum(["in_app", "whatsapp"])).optional(),
      displaySurface: z.enum(["bell", "toast", "popup"]).optional(),
      cooldownMinutes: z.number().int().min(1).max(1440).nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const existing = await prisma.alertRule.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        organizationId: true,
        createdBy: true,
        eventType: true,
      },
    });
    if (
      !existing ||
      (existing.organizationId !== null &&
        existing.organizationId !== organizationId)
    ) {
      throw errors.NOT_FOUND();
    }

    const isCreator = existing.createdBy === context.user.id;
    const isAdmin = await userIsOrgAdmin(context.user.id, organizationId);
    if (!isCreator && !isAdmin) {
      throw errors.FORBIDDEN({
        message: "Só o criador ou admin/owner pode editar essa regra.",
      });
    }

    const def = getAlertEvent(existing.eventType);
    const data: Prisma.AlertRuleUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined)
      data.description = input.description;

    if (input.params !== undefined && def) {
      const parsed = def.paramsSchema.safeParse(input.params);
      if (!parsed.success) {
        throw errors.BAD_REQUEST({
          message: `Params inválidos: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        });
      }
      data.params = parsed.data as Prisma.InputJsonValue;
    }

    if (input.severity !== undefined) {
      const sev = isSeverity(input.severity) ? input.severity : "info";
      data.severity = sev;
      // Re-deriva displaySurface se user não enviou explícito.
      if (input.displaySurface === undefined) {
        data.displaySurface = resolveDisplaySurface(sev);
      }
    }

    if (input.displaySurface !== undefined) {
      if (isDisplaySurface(input.displaySurface)) {
        data.displaySurface = input.displaySurface;
      }
    }

    if (input.audience !== undefined && def) {
      if (!def.audienceOptions.includes(input.audience.kind)) {
        throw errors.BAD_REQUEST({
          message: `Audiência "${input.audience.kind}" não é válida pra ${
            existing.eventType
          }.`,
        });
      }
      // Mesmo fallback do create-rule: kind=user sem userIds → injeta o criador.
      const audienceToPersist =
        input.audience.kind === "user" &&
        (!input.audience.userIds || input.audience.userIds.length === 0)
          ? { ...input.audience, userIds: [existing.createdBy] }
          : input.audience;
      data.audience = audienceToPersist as unknown as Prisma.InputJsonValue;
    }

    if (input.channels !== undefined) {
      data.channels = input.channels as unknown as Prisma.InputJsonValue;
    }

    if (input.cooldownMinutes !== undefined) {
      data.cooldownMinutes = input.cooldownMinutes;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    const updated = await prisma.alertRule.update({
      where: { id: input.id },
      data,
      select: { id: true, isActive: true },
    });
    return updated;
  });
