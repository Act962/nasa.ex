import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { z } from "zod";

import { DEFAULT_STAR_RULES } from "@/data/star-rules";

/**
 * Admin: CRUD de "Regras de Stars" GLOBAIS.
 *
 * Hoje as regras de custo por ação ficam armazenadas no model
 * `AppStarCost` (que é global por `appSlug @unique`) — convenção:
 *   - `appSlug` = chave da ação (ex: "astro_prompt")
 *   - `monthlyCost` = custo em ★
 *   - `category` = "action" (distingue de `category="app"` legado)
 *   - `displayName` = label exibido pro user
 *
 * Mudança de regra reflete em TODAS as orgs no próximo uso de
 * `chargeStarsByAction`.
 */

const ruleOutput = z.object({
  id: z.string(),
  action: z.string(),
  label: z.string(),
  stars: z.number(),
  cooldownHours: z.number().nullable(),
  isActive: z.boolean(),
  popupTemplateId: z.string().nullable(),
  popupTemplateName: z.string().nullable(),
  category: z.string(),
});

/**
 * Garante que o catálogo global tem o seed inicial vindo de
 * DEFAULT_STAR_RULES. Idempotente — só cria linhas que ainda
 * não existem em `AppStarCost`.
 */
async function ensureGlobalStarRules() {
  const existing = await prisma.appStarCost.findMany({
    where: { category: "action" },
    select: { appSlug: true },
  });
  const existingSet = new Set(existing.map((r) => r.appSlug));

  for (const rule of DEFAULT_STAR_RULES) {
    if (existingSet.has(rule.action)) continue;
    await prisma.appStarCost.create({
      data: {
        appSlug: rule.action,
        monthlyCost: rule.stars,
        setupCost: 0,
        displayName: rule.label,
        category: "action",
        isPublic: true,
      },
    });
  }
}

export const adminGetStarRules = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: get global star rules" })
  .input(z.object({ orgId: z.string().optional() }).optional())
  .output(z.array(ruleOutput))
  .handler(async () => {
    await ensureGlobalStarRules();
    const rows = await prisma.appStarCost.findMany({
      where: { category: "action" },
      orderBy: [{ displayName: "asc" }],
    });
    // Categoriza pra UI agrupar — usa DEFAULT_STAR_RULES como fonte de
    // verdade pra categoria semântica (leads, ai, forge, etc.). Pra
    // ações criadas manualmente que não estão em DEFAULT_STAR_RULES,
    // usa "custom".
    const semanticCategory = Object.fromEntries(
      DEFAULT_STAR_RULES.map((r) => [r.action, r.category]),
    );
    return rows.map((r) => ({
      id: r.id,
      action: r.appSlug,
      label: r.displayName ?? r.appSlug,
      stars: r.monthlyCost,
      cooldownHours: null,
      isActive: r.monthlyCost > 0,
      popupTemplateId: null,
      popupTemplateName: null,
      category: semanticCategory[r.appSlug] ?? "custom",
    }));
  });

export const adminCreateStarRule = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin: create global star rule" })
  .input(
    z.object({
      orgId: z.string().optional(), // ignorado — regras são globais agora
      action: z.string().min(1),
      label: z.string().min(1),
      stars: z.number().min(0),
      cooldownHours: z.number().nullable().optional(),
      popupTemplateId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input, errors }) => {
    const existing = await prisma.appStarCost.findUnique({
      where: { appSlug: input.action },
      select: { id: true },
    });
    if (existing) {
      throw errors.BAD_REQUEST({
        message: `Já existe uma regra com a action "${input.action}"`,
      });
    }
    const created = await prisma.appStarCost.create({
      data: {
        appSlug: input.action,
        monthlyCost: input.stars,
        setupCost: 0,
        displayName: input.label,
        category: "action",
        isPublic: true,
      },
    });
    return { success: true, id: created.id };
  });

export const adminUpdateStarRule = base
  .use(requireAdminMiddleware)
  .route({ method: "PATCH", summary: "Admin: update global star rule" })
  .input(
    z.object({
      id: z.string(),
      stars: z.number().min(0).optional(),
      cooldownHours: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
      label: z.string().optional(),
      popupTemplateId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    // `isActive=false` é representado como `monthlyCost=0` no
    // AppStarCost — `chargeStarsByAction` já trata cost=0 como "skip".
    const data: Record<string, unknown> = {};
    if (input.label !== undefined) data.displayName = input.label;
    if (input.stars !== undefined) data.monthlyCost = input.stars;
    if (input.isActive === false) data.monthlyCost = 0;

    await prisma.appStarCost.update({
      where: { id: input.id },
      data,
    });
    return { success: true };
  });

export const adminDeleteStarRule = base
  .use(requireAdminMiddleware)
  .route({ method: "DELETE", summary: "Admin: delete global star rule" })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.appStarCost.delete({ where: { id: input.id } });
    return { success: true };
  });
