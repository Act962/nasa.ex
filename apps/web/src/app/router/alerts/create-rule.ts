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
 * Cria uma nova AlertRule a partir da página de Automações.
 *
 * Mesma lógica do tool `create_alert_rule` do Astro automation-agent,
 * exposto via oRPC pra UI consumir direto.
 *
 * Permissão: só admin/owner da organização ativa.
 */
export const createAlertRule = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/alerts/create-rule",
    summary: "Cria uma regra de alerta",
  })
  .input(
    z.object({
      name: z.string().min(3).max(80),
      description: z.string().optional(),
      eventType: z.string(),
      params: z.record(z.string(), z.unknown()).default({}),
      severity: z.enum(["info", "warning", "critical"]),
      audience: z.object({
        kind: z.enum(AUDIENCE_KINDS),
        userIds: z.array(z.string()).optional(),
      }),
      channels: z.array(z.enum(["in_app", "whatsapp"])).default(["in_app"]),
      displaySurface: z.enum(["bell", "toast", "popup"]).optional(),
      cooldownMinutes: z.number().int().min(1).max(1440).optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    if (!(await userIsOrgAdmin(context.user.id, organizationId))) {
      throw errors.FORBIDDEN({
        message: "Você precisa ser admin ou owner pra criar regras.",
      });
    }

    const def = getAlertEvent(input.eventType);
    if (!def) {
      throw errors.BAD_REQUEST({
        message: `Evento "${input.eventType}" não está no catálogo.`,
      });
    }

    const paramsParsed = def.paramsSchema.safeParse(input.params);
    if (!paramsParsed.success) {
      throw errors.BAD_REQUEST({
        message: `Params inválidos: ${paramsParsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      });
    }

    if (!def.audienceOptions.includes(input.audience.kind)) {
      throw errors.BAD_REQUEST({
        message: `Audiência "${input.audience.kind}" não é válida pra ${
          input.eventType
        }. Opções: ${def.audienceOptions.join(", ")}.`,
      });
    }

    // Quando kind=user ("Só pra mim") e o cliente não enviou userIds explícitos,
    // injeta o id do criador. Sem isso o resolver de audiência retorna [] e o
    // alerta é silenciosamente descartado.
    const audienceToPersist =
      input.audience.kind === "user" &&
      (!input.audience.userIds || input.audience.userIds.length === 0)
        ? { ...input.audience, userIds: [context.user.id] }
        : input.audience;

    const severity = isSeverity(input.severity) ? input.severity : "info";
    const displaySurface =
      input.displaySurface && isDisplaySurface(input.displaySurface)
        ? input.displaySurface
        : resolveDisplaySurface(severity);

    const created = await prisma.alertRule.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description ?? null,
        eventType: input.eventType,
        params: paramsParsed.data as Prisma.InputJsonValue,
        severity,
        audience: audienceToPersist as unknown as Prisma.InputJsonValue,
        channels: input.channels as unknown as Prisma.InputJsonValue,
        displaySurface,
        isActive: true,
        createdBy: context.user.id,
        cooldownMinutes: input.cooldownMinutes ?? null,
      },
      select: { id: true, name: true },
    });

    return created;
  });
