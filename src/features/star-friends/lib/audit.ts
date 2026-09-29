import "server-only";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { STAR_FRIENDS_APP_SLUG } from "./constants";
import type { LoyaltyActor } from "./actor";

// Toda movimentação vai para o log de atividades da org e, quando há lead,
// para a Jornada — o extrato em si já é o registro primário.
export async function auditLoyaltyAction(input: {
  organizationId: string;
  actor: LoyaltyActor;
  action: string;
  actionLabel: string;
  leadId?: string | null;
  resourceId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actor.userId ?? "system",
    userName: input.actor.name,
    userEmail: input.actor.email ?? "sistema@nasa",
    userImage: input.actor.image ?? null,
    appSlug: STAR_FRIENDS_APP_SLUG,
    action: input.action,
    actionLabel: input.actionLabel,
    resource: "STAR FRIENDS",
    resourceId: input.resourceId,
    metadata: input.metadata,
  }).catch((error) => console.error("[star-friends] log_activity_failed", error));

  if (input.leadId) {
    await recordLeadEvent({
      leadId: input.leadId,
      eventType: "NOTE",
      userId: input.actor.userId,
      notes: `STAR FRIENDS · ${input.actionLabel}`,
      metadata: { app: STAR_FRIENDS_APP_SLUG, action: input.action },
    }).catch((error) => console.error("[star-friends] lead_event_failed", error));
  }
}
