import "server-only";

import prisma from "@/lib/prisma";
import { createNotification, NOTIF_TYPES } from "@/features/admin/lib/notification-service";
import { resolveEffectivePermissions } from "@/features/payment/lib/permissions";

// "Encontrei N documentos no e-mail" (spec 0018, CA-4) para quem pode ver
// lançamentos no financeiro — é quem consegue abrir o que foi encontrado.

const INBOX_ACTION_URL = "/payment?tab=documents";

async function listInboxWatcherIds(organizationId: string): Promise<string[]> {
  const accesses = await prisma.paymentAccess.findMany({
    where: { organizationId, isAuthorized: true },
    select: { userId: true, role: true, permissions: true },
  });
  return accesses
    .filter((access) => resolveEffectivePermissions(access.role, access.permissions).entries?.view ?? false)
    .map((access) => access.userId);
}

export async function notifyInboxFindings(params: {
  organizationId: string;
  proposedCount: number;
  accountEmail: string | null;
}): Promise<{ notified: number }> {
  const watcherIds = await listInboxWatcherIds(params.organizationId);
  if (watcherIds.length === 0) return { notified: 0 };

  const documentsLabel = params.proposedCount === 1 ? "1 documento" : `${params.proposedCount} documentos`;
  const mailboxLabel = params.accountEmail ? ` na caixa ${params.accountEmail}` : " no e-mail";

  await Promise.all(
    watcherIds.map((userId) =>
      createNotification({
        userId,
        organizationId: params.organizationId,
        type: NOTIF_TYPES.CUSTOM,
        title: "Caixa de entrada do financeiro",
        body: `Encontrei ${documentsLabel}${mailboxLabel}. Revise em Documentos ou peça ao Astro pra lançar.`,
        appKey: "financeiro",
        actionUrl: INBOX_ACTION_URL,
        metadata: { source: "payment_inbox", proposedCount: params.proposedCount },
        severity: "info",
      }).catch((error) => {
        console.error(`[payment/inbox] notificação falhou para ${userId}:`, error);
      }),
    ),
  );

  return { notified: watcherIds.length };
}
