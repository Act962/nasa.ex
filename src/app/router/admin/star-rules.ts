import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { invalidateOrgRules, invalidateAllRules } from "@/lib/rules-cache";
import { z } from "zod";

import { DEFAULT_STAR_RULES, STAR_RULE_CATEGORY_LABEL } from "@/data/star-rules";

async function ensureOrgStarRules(orgId: string) {
  for (const rule of DEFAULT_STAR_RULES) {
    const { category: _cat, ...data } = rule;
    await prisma.starRule.upsert({
      where: { orgId_action: { orgId, action: rule.action } },
      create: { ...data, orgId },
      update: {},
    });
  }
}

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

export const adminGetStarRules = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: get star rules for org" })
  .input(z.object({ orgId: z.string() }))
  .output(z.array(ruleOutput))
  .handler(async ({ input }) => {
    await ensureOrgStarRules(input.orgId);
    const rules = await prisma.starRule.findMany({
      where: { orgId: input.orgId },
      orderBy: [{ isActive: "desc" }, { label: "asc" }],
    });
    const tplIds = [
      ...new Set(rules.map((r) => r.popupTemplateId).filter(Boolean)),
    ] as string[];
    const tplMap: Record<string, string> = {};
    if (tplIds.length) {
      const tpls = await prisma.achievementPopupTemplate.findMany({
        where: { id: { in: tplIds } },
        select: { id: true, name: true },
      });
      tpls.forEach((t) => {
        tplMap[t.id] = t.name;
      });
    }
    const catMap = Object.fromEntries(
      DEFAULT_STAR_RULES.map((r) => [r.action, r.category]),
    );
    return rules.map((r) => ({
      id: r.id,
      action: r.action,
      label: r.label,
      stars: r.stars,
      cooldownHours: r.cooldownHours,
      isActive: r.isActive,
      popupTemplateId: r.popupTemplateId ?? null,
      popupTemplateName: r.popupTemplateId
        ? (tplMap[r.popupTemplateId] ?? null)
        : null,
      category: catMap[r.action] ?? "custom",
    }));
  });

export const adminCreateStarRule = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin: create star rule for org" })
  .input(
    z.object({
      orgId: z.string(),
      action: z.string().min(1),
      label: z.string().min(1),
      stars: z.number().min(0),
      cooldownHours: z.number().nullable().optional(),
      popupTemplateId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input }) => {
    const { orgId, ...data } = input;
    const created = await prisma.starRule.create({
      data: {
        orgId,
        ...data,
        cooldownHours: data.cooldownHours ?? null,
        popupTemplateId: data.popupTemplateId ?? null,
      },
    });
    invalidateOrgRules(orgId);
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
    const { id, ...data } = input;
    const updated = await prisma.starRule.update({
      where: { id },
      data,
      select: { orgId: true },
    });
    invalidateOrgRules(updated.orgId);
    return { success: true };
  });
