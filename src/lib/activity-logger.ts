import prisma from "./prisma";
import { emitTracking } from "./tracking-emitter";
export { APP_LABELS, APP_SLUGS } from "./activity-constants";

// ── Mapeamento: `appSlug:action` → tracking action (SP/Stars) ──────────────
const ACTIVITY_TO_TRACKING: Record<string, string> = {
  // CRM / Leads & Tracking
  "tracking:lead.created":          "create_lead",
  "tracking:lead.updated":          "update_lead",
  "tracking:lead.won":              "lead_won",
  "tracking:lead.imported":         "lead_import_batch",
  "tracking:lead.moved":            "move_lead_stage",
  "tracking:tracking.created":      "create_pipeline",
  // Forge
  "forge:proposal.created":         "create_proposal",
  "forge:proposal.sent":            "forge_proposal_send",
  "forge:contract.created":         "forge_contract_create",
  "forge:contract.signed":          "contract_signed",
  // NASA Planner
  "nasa-planner:planner.card.created":  "create_post",
  "nasa-planner:planner.created":       "create_mindmap",
  "nasa-planner:planner.card.published":"post_published",
  // Agenda / SpaceTime
  "spacetime:event.created":        "create_event",
  "spacetime:appointment.created":  "appointment_create",
  "spacetime:agenda.created":       "agenda_create",
  // N.Box
  "nbox:nbox.item.created":         "upload_nbox",
  "nbox:nbox.folder.created":       "nbox_upload",
  // Chat
  "chat:message.sent":              "send_message",
  // Integrações
  "integrations:integration.whatsapp.created": "connect_integration",
  "integrations:integration.created":          "connect_integration",
  // Explorer / Workspace
  "explorer:workspace.column.created": "workspace_board_create",
  "explorer:workspace.card.created":   "workspace_card_create",
  // Workflows
  "tracking:workflow.created":      "automation_created",
  // IA
  "system:ai.command.executed":     "ai_command",
  // System
  "auth:auth.login":                "daily_login",
  "system:stars.purchased":         "plan_renewed",
};

export interface ActivityData {
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userImage?: string | null;
  appSlug: string;
  action: string;
  actionLabel: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(data: ActivityData): Promise<void> {
  try {
    await prisma.systemActivityLog.create({ data });
  } catch (e) {
    console.error("[activity-logger] failed:", e);
  }

  // ── Emit tracking event (fire-and-forget) ────────────────────────────────
  const trackingKey = `${data.appSlug}:${data.action}`;
  const trackingAction = ACTIVITY_TO_TRACKING[trackingKey];
  if (trackingAction) {
    emitTracking({
      userId:   data.userId,
      orgId:    data.organizationId,
      action:   trackingAction,
      metadata: data.metadata ?? undefined,
      source:   "route",
    }).catch(() => {}); // fire-and-forget
  }
}
