import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { IntegrationPlatform, MetaPublishAccountKind, MetaPublishAccountStatus } from "@/generated/prisma/enums";
import { listUserPagesWithTokens, pingGraphObject } from "@/http/meta/planner-graph";
import { classifyPublishError } from "@/features/nasa-planner/server/publishing/meta-errors";
import { upsertPublishAccounts } from "@/features/nasa-planner/server/publishing/publish-accounts";
import { createNotification, NOTIF_TYPES } from "@/features/admin/lib/notification-service";

/** Saúde diária das páginas do Facebook (spec 0057, RF-12; as contas do Instagram são cuidadas pela rotina dos Satélites, spec 0071) e backfill das orgs conectadas antes da spec (RF-3). */

async function notifyOrganizationOwners(organizationId: string, accountLabel: string) {
  const owners = await prisma.member.findMany({
    where: { organizationId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
  });
  await Promise.all(
    owners.map((owner) =>
      createNotification({
        userId: owner.userId,
        organizationId,
        type: NOTIF_TYPES.PLANNER_ACCOUNT_RECONNECT,
        title: "Reconecte a conta da Meta",
        body: `A conexão de ${accountLabel} expirou. Sem ela, os posts programados não saem.`,
        appKey: "nasa-planner",
        actionUrl: "/integrations/meta",
        severity: "warning",
      }),
    ),
  );
}

export const plannerPublishAccountsHealth = inngest.createFunction(
  { id: "nasa-planner-publish-accounts-health", retries: 1 },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const activeAccounts = await step.run("list-active", () =>
      prisma.metaPublishAccount.findMany({
        where: { status: MetaPublishAccountStatus.ACTIVE, kind: MetaPublishAccountKind.FB_PAGE },
        select: { id: true },
      }),
    );
    let reconnectCount = 0;
    for (const { id: accountId } of activeAccounts) {
      const needsReconnect = await step.run(`check-${accountId}`, async () => {
        const account = await prisma.metaPublishAccount.findUniqueOrThrow({ where: { id: accountId } });
        try {
          await pingGraphObject(decryptSecret(account.accessTokenEnc), account.pageId);
          await prisma.metaPublishAccount.update({ where: { id: accountId }, data: { lastCheckedAt: new Date() } });
          return false;
        } catch (error) {
          const classified = classifyPublishError(error);
          await prisma.metaPublishAccount.update({
            where: { id: accountId },
            data: {
              lastCheckedAt: new Date(),
              lastErrorCode: classified.code,
              lastErrorMessage: classified.message,
              ...(classified.needsReconnect && { status: MetaPublishAccountStatus.NEEDS_RECONNECT }),
            },
          });
          if (classified.needsReconnect) {
            await notifyOrganizationOwners(account.organizationId, account.pageName ?? "uma página");
          }
          return classified.needsReconnect;
        }
      });
      if (needsReconnect) reconnectCount++;
    }
    return { checked: activeAccounts.length, needsReconnect: reconnectCount };
  },
);

/** Disparo manual (Inngest): cria as contas de publicação das orgs que já tinham a Meta conectada. */
export const plannerBackfillPublishAccounts = inngest.createFunction(
  { id: "nasa-planner-backfill-publish-accounts", retries: 0 },
  { event: "nasa-planner/backfill-publish-accounts" },
  async ({ event, step }) => {
    const onlyOrganizationId = (event.data as { organizationId?: string }).organizationId;
    const integrations = await step.run("list-meta-integrations", () =>
      prisma.platformIntegration.findMany({
        where: { platform: IntegrationPlatform.META, isActive: true, ...(onlyOrganizationId && { organizationId: onlyOrganizationId }) },
        select: { organizationId: true },
      }),
    );
    let backfilledCount = 0;
    for (const { organizationId } of integrations) {
      const isBackfilled = await step.run(`backfill-${organizationId}`, async () => {
        const integration = await prisma.platformIntegration.findFirstOrThrow({
          where: { organizationId, platform: IntegrationPlatform.META },
          select: { config: true },
        });
        const metaConfig = integration.config as { accessToken?: string; selectedPageIds?: string[] } | null;
        const userAccessToken = metaConfig?.accessToken;
        if (!userAccessToken) return false;
        const selectedPageIds = new Set(metaConfig?.selectedPageIds ?? []);
        try {
          // Respeita as páginas escolhidas na conexão; conexão antiga sem seleção traz todas.
          const pages = (await listUserPagesWithTokens(userAccessToken)).filter(
            (page) => selectedPageIds.size === 0 || selectedPageIds.has(page.id),
          );
          await upsertPublishAccounts(
            organizationId,
            pages,
            pages.flatMap((page) =>
              page.instagram_business_account
                ? [{ ...page.instagram_business_account, page_id: page.id }]
                : [],
            ),
          );
          return true;
        } catch (error) {
          console.warn("[planner-backfill] org sem token válido:", organizationId, classifyPublishError(error).code);
          return false;
        }
      });
      if (isBackfilled) backfilledCount++;
    }
    return { organizations: integrations.length, backfilled: backfilledCount };
  },
);
