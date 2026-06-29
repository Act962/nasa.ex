import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { MetaAccountKind } from "@/generated/prisma/enums";
import { getAuthorizedAccountKeys } from "../meta-ads/_access";

function normalizeAdAccountId(raw: string): string {
  if (!raw) return raw;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export const setActiveMetaAccount = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ adAccountId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const userId = context.user.id;
    const target = normalizeAdAccountId(input.adAccountId);

    const integration = await prisma.platformIntegration.findUnique({
      where: { organizationId_platform: { organizationId: orgId, platform: "META" } },
    });
    if (!integration || !integration.isActive) {
      throw new ORPCError("NOT_FOUND", { message: "Integração Meta não conectada" });
    }

    const cfg = (integration.config ?? {}) as Record<string, unknown>;
    const adAccounts = (cfg.adAccounts as Array<{ id?: string; account_id?: string }> | undefined) ?? [];
    const exists = adAccounts.some((a) => normalizeAdAccountId(a.account_id ?? a.id ?? "") === target);
    if (!exists) {
      throw new ORPCError("BAD_REQUEST", { message: "Conta não encontrada na integração" });
    }

    const allowed = await getAuthorizedAccountKeys(orgId, userId, MetaAccountKind.AD_ACCOUNT);
    if (allowed !== null && !allowed.map(normalizeAdAccountId).includes(target)) {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão para essa conta Meta" });
    }

    const activeByUser = (cfg.activeByUser as Record<string, { adAccountId?: string }> | undefined) ?? {};
    const nextActive = { ...activeByUser, [userId]: { adAccountId: target } };
    const nextConfig = { ...cfg, activeByUser: nextActive };

    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { config: nextConfig as unknown as object },
    });

    return { success: true, adAccountId: target };
  });
