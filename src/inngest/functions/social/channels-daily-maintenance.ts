import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  channelMaintenance,
  createContentPublisher,
  instagramCredentialRenewer,
  socialClock,
  socialLogger,
  socialRepositoriesForOrganization,
} from "@/modules/social";
import { refreshChannelCapabilities, renewChannelCredentials } from "@/modules/social/application/maintain-channel";
import { createNotification, NOTIF_TYPES } from "@/features/admin/lib/notification-service";

/** Cuidado diário das contas dos Satélites (spec 0071): renova o token que está para vencer e confere o que a conta consegue fazer. */

async function notifyAccountNeedsReconnect(organizationId: string, channelId: string) {
  const [channel, admins] = await Promise.all([
    prisma.socialChannel.findFirst({ where: { id: channelId, organizationId }, select: { handle: true, externalAccountId: true } }),
    prisma.member.findMany({ where: { organizationId, role: { in: ["owner", "admin"] } }, select: { userId: true } }),
  ]);
  const accountLabel = channel?.handle ? `@${channel.handle}` : "uma conta do Instagram";
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.userId,
        organizationId,
        type: NOTIF_TYPES.PLANNER_ACCOUNT_RECONNECT,
        title: "Troque a credencial do Instagram",
        body: `O token de ${accountLabel} foi recusado. Sem ele, os posts programados não saem e as automações param.`,
        appKey: "nasa-planner",
        actionUrl: "/integrations/instagram",
        severity: "warning",
      }),
    ),
  );
}

export const socialChannelsDailyMaintenance = inngest.createFunction(
  { id: "social-channels-daily-maintenance", retries: 1 },
  { cron: "30 8 * * *" },
  async ({ step }) => {
    const channelRefs = await step.run("list-active", () => channelMaintenance.listActiveChannelRefs());
    const totals = { checked: 0, renewed: 0, renewalFailed: 0, needsReconnect: 0 };

    for (const { channelId, organizationId } of channelRefs) {
      const outcome = await step.run(`care-${channelId}`, async () => {
        const { channels } = socialRepositoriesForOrganization(organizationId);
        try {
          const renewal = await renewChannelCredentials(channelId, { channels, renewer: instagramCredentialRenewer, now: () => socialClock.now() });
          if (renewal.status === "failed") socialLogger.warn("renovação de token falhou", { channelId, error: renewal.error });
          const capabilities =
            renewal.status === "needs-reconnect" ? renewal : await refreshChannelCapabilities(channelId, { channels, createPublisher: createContentPublisher });
          const needsReconnect = capabilities.status === "needs-reconnect";
          if (needsReconnect) await notifyAccountNeedsReconnect(organizationId, channelId);
          return { renewal: renewal.status, needsReconnect };
        } catch (error) {
          // Uma conta com problema não interrompe as outras (RNF-4).
          socialLogger.warn("cuidado diário da conta falhou", { channelId, error: error instanceof Error ? error.message : String(error) });
          return { renewal: "failed" as const, needsReconnect: false };
        }
      });
      totals.checked++;
      if (outcome.renewal === "renewed") totals.renewed++;
      if (outcome.renewal === "failed") totals.renewalFailed++;
      if (outcome.needsReconnect) totals.needsReconnect++;
    }
    return totals;
  },
);
