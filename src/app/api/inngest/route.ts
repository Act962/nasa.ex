import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeWorkflow } from "@/inngest/functions";
import { executeWorkspaceWorkflow } from "@/inngest/functions/workspace-workflow-executor";
import { bookingNotification } from "@/inngest/functions/booking-notification";
import { processUserAction } from "@/inngest/functions/process-user-action";
import { detectAbsence } from "@/inngest/functions/crons/detect-absence";
import { detectOverdue } from "@/inngest/functions/crons/detect-overdue";
import { detectChatTimeout } from "@/inngest/functions/crons/detect-chat-timeout";
import { checkStreaks } from "@/inngest/functions/crons/check-streaks";
import { checkMilestones } from "@/inngest/functions/crons/check-milestones";
import { onProposalPaid } from "@/inngest/functions/on-proposal-paid";
import { onOnboardingFormsCompleted } from "@/inngest/functions/on-onboarding-forms-completed";
import { processReminder } from "@/inngest/functions/crons/check-reminders";
import { partnerReferralActivityRecalc } from "@/inngest/functions/crons/partner-referral-activity-recalc";
import {
  partnerTierRecalcDaily,
  partnerTierRecalcMany,
  partnerTierRecalcOne,
} from "@/inngest/functions/crons/partner-tier-recalc";
import { partnerPayoutCloseCycle } from "@/inngest/functions/crons/partner-payout-close-cycle";
import { partnerGracePeriodMonitor } from "@/inngest/functions/crons/partner-grace-period-monitor";
import { starsGracePeriodMonitor } from "@/inngest/functions/crons/stars-grace-period-monitor";
import { starsPendingSweep } from "@/inngest/functions/crons/stars-pending-sweep";
import { coursePublicPurchasePaid } from "@/inngest/functions/course-public-purchase-paid";
import { publishPostHandler } from "@/inngest/functions/nasa-planner/publish-post-handler";
import { publishScheduledPosts } from "@/inngest/functions/nasa-planner/publish-scheduled-posts";
import { refreshMetaTokens } from "@/inngest/functions/nasa-planner/refresh-meta-tokens";
import { syncPostMetricsCron } from "@/inngest/functions/nasa-planner/sync-post-metrics-cron";
import { syncMetaAdsKpis } from "@/inngest/functions/crons/sync-meta-ads-kpis";
import { syncMetaAdsStructure } from "@/inngest/functions/crons/sync-meta-ads-structure";
import { nasaRouteSubscriptionRenew } from "@/inngest/functions/crons/nasa-route-subscription-renew";
import { nasaRouteVideoUploadsCleanup } from "@/inngest/functions/crons/nasa-route-video-uploads-cleanup";
import { nasaRouteArchivePastEvents } from "@/inngest/functions/crons/nasa-route-archive-past-events";
import { onVideoUploadProgress } from "@/inngest/functions/nasa-route/on-video-upload-progress";
import { onVideoUploadCompleted } from "@/inngest/functions/nasa-route/on-video-upload-completed";
import { nasaRoutePurchaseEmail } from "@/inngest/functions/nasa-route/purchase-email";
import { astroIngestKnowledge } from "@/inngest/functions/astro/ingest-knowledge";
import { astroAgentTrigger } from "@/inngest/functions/astro/agent-trigger";
import { chatSyncMessages } from "@/inngest/functions/chat/sync-conversation-messages";
import { autoResolveExpiredClaims } from "@/inngest/functions/calendar/auto-resolve-expired-claims";
import { detectStaleLeads } from "@/inngest/functions/crons/detect-stale-leads";
import { detectBrokenIntegrations } from "@/inngest/functions/crons/detect-broken-integrations";
import { detectWhatsappBan } from "@/inngest/functions/crons/detect-whatsapp-ban";
import { detectAgendaStarting } from "@/inngest/functions/crons/detect-agenda-starting";
import { detectFormAbandoned } from "@/inngest/functions/crons/detect-form-abandoned";
import { detectLowMetrics } from "@/inngest/functions/crons/detect-low-metrics";
import { worldEventOccupancyTick } from "@/inngest/functions/crons/world-event-occupancy-tick";
import { detectActionsDueSoon } from "@/inngest/functions/crons/detect-actions-due-soon";
import { formSendWhatsappNotification } from "@/inngest/functions/form/send-whatsapp-notification";
import { chatAiWhatsappAgent } from "@/inngest/functions/chat-ai/whatsapp-agent";
import {
  scheduleIdleChecks,
  checkNoFirstResponse,
  checkInConvIdle,
} from "@/inngest/functions/triggers/idle-automation";
import {
  autoAgentTickScheduledFn,
  autoAgentOnLeadReplyFn,
} from "@/inngest/functions/auto-agent-scheduler";
import {
  agentTriggerPaymentReceivedFn,
  agentTriggerMessageIncomingFn,
  agentTriggerWebhookExternalFn,
} from "@/inngest/functions/agent-workflow-triggers";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    executeWorkflow,
    executeWorkspaceWorkflow,
    processReminder,
    // ── NASA Partner ──
    partnerReferralActivityRecalc,
    partnerTierRecalcDaily,
    partnerTierRecalcMany,
    partnerTierRecalcOne,
    partnerPayoutCloseCycle,
    partnerGracePeriodMonitor,
    // ── STARS grace monitor (diário 09h UTC) ──
    starsGracePeriodMonitor,
    // ── STARS: varredura de pendências Stripe órfãs (de hora em hora) ──
    starsPendingSweep,
    // ── NASA Router (checkout público de curso) ──
    coursePublicPurchasePaid,
    // ── NASA Planner ──
    publishPostHandler,
    publishScheduledPosts,
    refreshMetaTokens,
    syncPostMetricsCron,
    // ── Meta Ads ──
    syncMetaAdsKpis,
    syncMetaAdsStructure,
    // ── NASA Route ──
    nasaRouteSubscriptionRenew,
    nasaRouteVideoUploadsCleanup,
    nasaRouteArchivePastEvents,
    onVideoUploadProgress,
    onVideoUploadCompleted,
    nasaRoutePurchaseEmail,
    // ── ASTRO ──
    astroIngestKnowledge,
    astroAgentTrigger,
    // ── Chat sync ──
    chatSyncMessages,
    // ── Chat AI (WhatsApp agent interno) ──
    chatAiWhatsappAgent,
    // ── Calendário Público: auto-resolução de reivindicações expiradas ──
    autoResolveExpiredClaims,
    // ── Forms: notificação WhatsApp ao submeter ──
    formSendWhatsappNotification,
    // ── Alerts: detecção time-based ──
    detectStaleLeads,
    detectBrokenIntegrations,
    detectWhatsappBan,
    detectAgendaStarting,
    detectFormAbandoned,
    detectLowMetrics,
    detectOverdue,
    // ── NASA World — convention occupancy ──
    worldEventOccupancyTick,
    detectActionsDueSoon,
    // ── Idle automation por tracking (substitui detect-leads-waiting-attention + LAST_INBOUND_TIMEOUT) ──
    scheduleIdleChecks,
    checkNoFirstResponse,
    checkInConvIdle,
    // ── NASA Auto Agent — scheduler de turns assíncronos ──
    autoAgentTickScheduledFn,
    autoAgentOnLeadReplyFn,
    // ── Modo Agente IA Visual — disparadores dos triggers novos ──
    agentTriggerPaymentReceivedFn,
    agentTriggerMessageIncomingFn,
    agentTriggerWebhookExternalFn,
    // bookingNotification,
    // processUserAction,
    // detectAbsence,
    // detectOverdue,
    // detectChatTimeout,
    // checkStreaks,
    // checkMilestones,
    // onProposalPaid,
    // onOnboardingFormsCompleted,
  ],
});
