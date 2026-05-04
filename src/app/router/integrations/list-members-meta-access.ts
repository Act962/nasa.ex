import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { MetaAccountKind } from "@/generated/prisma/enums";
import { assertIsFullAccessMember } from "../meta-ads/_access";

type MetaAdAccount = { id?: string; account_id?: string; name: string; currency?: string | null };
type MetaPage = { id: string; name: string; category?: string | null };
type MetaIgAccount = { id: string; username?: string; name?: string; page_id?: string };

function normalizeAdAccountId(raw: string): string {
  if (!raw) return raw;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

export const listMembersWithMetaAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;
    await assertIsFullAccessMember(orgId, context.user.id);

    const integration = await prisma.platformIntegration.findUnique({
      where: { organizationId_platform: { organizationId: orgId, platform: "META" } },
    });

    const connected = Boolean(integration?.isActive);
    const cfg = (integration?.config ?? {}) as Record<string, unknown>;

    const allAdAccounts = ((cfg.adAccounts as MetaAdAccount[] | undefined) ?? []).map((a) => ({
      key: normalizeAdAccountId(a.account_id ?? a.id ?? ""),
      label: a.name,
      hint: a.currency ? `${a.currency}` : null,
    }));
    const allPages = ((cfg.pages as MetaPage[] | undefined) ?? []).map((p) => ({
      key: p.id,
      label: p.name,
      hint: p.category ?? null,
    }));
    const allIg = ((cfg.igAccounts as MetaIgAccount[] | undefined) ?? []).map((i) => ({
      key: i.id,
      label: i.username ? `@${i.username}` : i.name ?? i.id,
      hint: i.name ?? null,
    }));

    const [members, accesses] = await Promise.all([
      prisma.member.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.memberMetaAccountAccess.findMany({
        where: { organizationId: orgId },
        select: { userId: true, kind: true, accountKey: true },
      }),
    ]);

    const accessByUser = new Map<string, { adAccountIds: string[]; pageIds: string[]; igAccountIds: string[] }>();
    for (const a of accesses) {
      const cur = accessByUser.get(a.userId) ?? { adAccountIds: [], pageIds: [], igAccountIds: [] };
      if (a.kind === MetaAccountKind.AD_ACCOUNT) cur.adAccountIds.push(normalizeAdAccountId(a.accountKey));
      else if (a.kind === MetaAccountKind.PAGE) cur.pageIds.push(a.accountKey);
      else if (a.kind === MetaAccountKind.IG_ACCOUNT) cur.igAccountIds.push(a.accountKey);
      accessByUser.set(a.userId, cur);
    }

    return {
      connected,
      catalog: { adAccounts: allAdAccounts, pages: allPages, igAccounts: allIg },
      members: members.map((m) => {
        const fullAccess = FULL_ACCESS_ROLES.has(m.role);
        const access = accessByUser.get(m.userId) ?? { adAccountIds: [], pageIds: [], igAccountIds: [] };
        return {
          memberId: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          fullAccess,
          access,
        };
      }),
    };
  });
