import "server-only";

import prisma from "@/lib/prisma";
import {
  createNotification,
  NOTIF_TYPES,
  type NotifType,
} from "@/features/admin/lib/notification-service";
import {
  resolveEffectivePermissions,
  type PaymentPermissionMatrix,
} from "../../lib/permissions";

/**
 * Alertas de meta vão para quem tem acesso autorizado ao módulo financeiro e
 * permissão de ver o dashboard — é a mesma porta que dá acesso aos números
 * citados na notificação.
 */
export async function listGoalWatcherIds(
  organizationId: string,
): Promise<string[]> {
  const accesses = await prisma.paymentAccess.findMany({
    where: { organizationId, isAuthorized: true },
    select: { userId: true, role: true, permissions: true },
  });

  return accesses
    .filter((access) => {
      const effective: PaymentPermissionMatrix = resolveEffectivePermissions(
        access.role,
        access.permissions,
      );
      return effective.dashboard?.view ?? false;
    })
    .map((access) => access.userId);
}

const GOAL_ACTION_URL = "/payment";

export async function notifyGoalWatchers(params: {
  organizationId: string;
  type: NotifType;
  title: string;
  body: string;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}): Promise<{ notified: number }> {
  const watcherIds = await listGoalWatcherIds(params.organizationId);

  if (watcherIds.length === 0) {
    console.warn(
      "[notifyGoalWatchers] nenhum usuário com dashboard/view na org",
      params.organizationId,
    );
    return { notified: 0 };
  }

  await Promise.all(
    watcherIds.map((userId) =>
      createNotification({
        userId,
        organizationId: params.organizationId,
        type: params.type,
        title: params.title,
        body: params.body,
        appKey: "financeiro",
        actionUrl: GOAL_ACTION_URL,
        metadata: params.metadata,
        severity: params.severity ?? "info",
      }).catch((err) => {
        console.error(
          `[notifyGoalWatchers] createNotification falhou para ${userId}:`,
          err,
        );
      }),
    ),
  );

  return { notified: watcherIds.length };
}

export const GOAL_NOTIF_TYPES = {
  reserveAtRisk: NOTIF_TYPES.PAYMENT_RESERVE_AT_RISK,
  goalReached: NOTIF_TYPES.PAYMENT_GOAL_REACHED,
  weeklySummary: NOTIF_TYPES.PAYMENT_GOAL_WEEKLY,
  expenseCritical: NOTIF_TYPES.PAYMENT_EXPENSE_CRITICAL,
} as const;

/** Centavos como "R$ 1.234,56" — usado no corpo das notificações. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
