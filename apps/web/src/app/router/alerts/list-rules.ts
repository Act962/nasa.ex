import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { APP_KEYS, type AppKey } from "@/features/alerts/lib/alert-catalog";

/**
 * Lista as AlertRules visíveis pra um user na organização ativa.
 *
 * Sem coluna `scope` ainda (feature pendente de migração) — toda regra
 * é considerada ORG-scope. Quando o dev rodar a migração, esse endpoint
 * passa a filtrar `scope=USER` pelo `createdBy=user.id` automaticamente.
 *
 * Filtros opcionais:
 *   - appKey: agrupa por aplicação (Tracking, Workspace, Agenda, etc).
 *     Derivado do `eventType` via lookup no catálogo client-side.
 *
 * Inclui contagem `lastDispatchAt` (último disparo registrado em
 * AlertDispatch) pra UI mostrar "last: 2h".
 */
export const listAlertRules = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/alerts/list-rules",
    summary: "Lista regras de alerta da organização ativa",
  })
  .input(
    z.object({
      appKey: z.enum(APP_KEYS).optional(),
      includeInactive: z.boolean().optional(),
    }),
  )
  .output(
    z.object({
      rules: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          eventType: z.string(),
          params: z.unknown(),
          severity: z.string(),
          audience: z.unknown(),
          channels: z.unknown(),
          displaySurface: z.string(),
          isActive: z.boolean(),
          cooldownMinutes: z.number().nullable(),
          createdBy: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          isGlobal: z.boolean(),
          lastDispatchAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const rules = await prisma.alertRule.findMany({
      where: {
        OR: [{ organizationId }, { organizationId: null }],
        ...(input.includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        eventType: true,
        params: true,
        severity: true,
        audience: true,
        channels: true,
        displaySurface: true,
        isActive: true,
        cooldownMinutes: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Last dispatch per rule
    const ruleIds = rules.map((r) => r.id);
    const lastByRule = new Map<string, Date>();
    if (ruleIds.length > 0) {
      const grouped = await prisma.alertDispatch.groupBy({
        by: ["alertRuleId"],
        where: { alertRuleId: { in: ruleIds } },
        _max: { dispatchedAt: true },
      });
      for (const g of grouped) {
        const dt = g._max?.dispatchedAt;
        if (dt) lastByRule.set(g.alertRuleId, dt);
      }
    }

    // Filtro por appKey — feito client-side da resposta porque eventType
    // não tem coluna appKey na DB; mapeamos via lookup no catálogo.
    // Importa direto pra evitar lookup linear sem cache (pequena lista).
    const { getAlertEvent } = await import(
      "@/features/alerts/lib/alert-catalog"
    );
    const filtered = input.appKey
      ? rules.filter((r) => {
          const def = getAlertEvent(r.eventType);
          return def?.appKey === (input.appKey as AppKey);
        })
      : rules;

    return {
      rules: filtered.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        eventType: r.eventType,
        params: r.params,
        severity: r.severity,
        audience: r.audience,
        channels: r.channels,
        displaySurface: r.displaySurface,
        isActive: r.isActive,
        cooldownMinutes: r.cooldownMinutes,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        isGlobal: r.organizationId === null,
        lastDispatchAt: lastByRule.get(r.id)?.toISOString() ?? null,
      })),
    };
  });
