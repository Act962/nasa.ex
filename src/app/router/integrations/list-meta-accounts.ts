import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { MetaAccountKind } from "@/generated/prisma/enums";
import { getAuthorizedAccountKeys } from "../meta-ads/_access";

type MetaAdAccount = { id: string; account_id?: string; name: string; currency?: string | null };
type MetaPage = { id: string; name: string; category?: string | null };
type MetaIgAccount = { id: string; username?: string; name?: string; page_id?: string };

function normalizeAdAccountId(raw: string): string {
  if (!raw) return raw;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export const listAvailableMetaAccounts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;
    const userId = context.user.id;

    const integration = await prisma.platformIntegration.findUnique({
      where: { organizationId_platform: { organizationId: orgId, platform: "META" } },
    });

    if (!integration || !integration.isActive) {
      return { connected: false, adAccounts: [], pages: [], igAccounts: [] };
    }

    const cfg = (integration.config ?? {}) as Record<string, unknown>;
    const allAdAccounts = (cfg.adAccounts as MetaAdAccount[] | undefined) ?? [];
    const allPages = (cfg.pages as MetaPage[] | undefined) ?? [];
    const allIg = (cfg.igAccounts as MetaIgAccount[] | undefined) ?? [];

    const [adAllowed, pageAllowed, igAllowed] = await Promise.all([
      getAuthorizedAccountKeys(orgId, userId, MetaAccountKind.AD_ACCOUNT),
      getAuthorizedAccountKeys(orgId, userId, MetaAccountKind.PAGE),
      getAuthorizedAccountKeys(orgId, userId, MetaAccountKind.IG_ACCOUNT),
    ]);

    const filterByKeys = <T>(items: T[], keys: string[] | null, getKey: (it: T) => string) => {
      if (keys === null) return items;
      const set = new Set(keys);
      return items.filter((it) => set.has(getKey(it)));
    };

    return {
      connected: true,
      adAccounts: filterByKeys(allAdAccounts, adAllowed?.map(normalizeAdAccountId) ?? null, (a) =>
        normalizeAdAccountId(a.account_id ?? a.id),
      ).map((a) => ({
        id: normalizeAdAccountId(a.account_id ?? a.id),
        name: a.name,
        currency: a.currency ?? null,
      })),
      pages: filterByKeys(allPages, pageAllowed, (p) => p.id).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category ?? null,
      })),
      igAccounts: filterByKeys(allIg, igAllowed, (i) => i.id).map((i) => ({
        id: i.id,
        username: i.username ?? null,
        name: i.name ?? null,
        pageId: i.page_id ?? null,
      })),
    };
  });
