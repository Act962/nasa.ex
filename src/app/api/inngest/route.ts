/**
 * ============================================================
 * Inngest serve endpoint — registra todos os jobs/crons do NASA.
 * ============================================================
 *
 * 🚨 DEV / PROD CHECKLIST (precisa fazer em produção):
 *
 * 1. Env vars obrigatórios (sem isso, Inngest não autentica e crons
 *    não rodam):
 *      INNGEST_EVENT_KEY=evt_...
 *      INNGEST_SIGNING_KEY=signkey_...
 *    Obtidos em https://app.inngest.com → Apps → SDK keys.
 *
 * 2. Registrar a app no Inngest Cloud:
 *    a. Crie um app "nasa-production" em https://app.inngest.com
 *    b. Em "Sync Methods" cole a URL pública desse endpoint:
 *         https://app.SEU-DOMINIO.com/api/inngest
 *    c. Click "Sync" — Inngest faz GET, descobre todos os functions
 *       declarados aqui e registra os crons no scheduler.
 *
 * 3. Verificar crons ativos:
 *    No dashboard Inngest, aba "Functions" deve listar (entre outros):
 *      detect-stale-leads          (a cada 30 min — Astro alerts)
 *      detect-broken-integrations  (hourly      — Astro alerts)
 *      detect-agenda-starting      (a cada 5 min  — Astro alerts)
 *      detect-form-abandoned       (a cada 15 min — Astro alerts)
 *      detect-low-metrics          (9h e 15h    — Astro alerts)
 *      detect-overdue              (hourly)
 *
 * 4. Se você adicionar uma function nova nesse array, faça um redeploy
 *    + click "Sync" de novo no painel pra Inngest descobrir.
 *
 * Dev local: o Inngest Dev Server (`pnpm inngest:dev`) descobre
 * automaticamente via :3000/api/inngest sem precisar de env keys.
 * ============================================================
 */
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
import { coursePublicPurchasePaid } from "@/inngest/functions/course-public-purchase-paid";
import { publishPostHandler } from "@/inngest/functions/nasa-planner/publish-post-handler";
import { publishScheduledPosts } from "@/inngest/functions/nasa-planner/publish-scheduled-posts";
import { refreshMetaTokens } from "@/inngest/functions/nasa-planner/refresh-meta-tokens";
import { syncPostMetricsCron } from "@/inngest/functions/nasa-planner/sync-post-metrics-cron";
import { syncMetaAdsKpis } from "@/inngest/functions/crons/sync-meta-ads-kpis";
import { syncMetaAdsStructure } from "@/inngest/functions/crons/sync-meta-ads-structure";
import { nasaRouteSubscriptionRenew } from "@/inngest/functions/crons/nasa-route-subscription-renew";
import { nasaRouteVideoUploadsCleanup } from "@/inngest/functions/crons/nasa-route-video-uploads-cleanup";
import { astroIngestKnowledge } from "@/inngest/functions/astro/ingest-knowledge";
import { astroAgentTrigger } from "@/inngest/functions/astro/agent-trigger";
import { chatSyncMessages } from "@/inngest/functions/chat/sync-conversation-messages";
import { autoResolveExpiredClaims } from "@/inngest/functions/calendar/auto-resolve-expired-claims";
import { detectStaleLeads } from "@/inngest/functions/crons/detect-stale-leads";
import { detectBrokenIntegrations } from "@/inngest/functions/crons/detect-broken-integrations";
import { detectAgendaStarting } from "@/inngest/functions/crons/detect-agenda-starting";
import { detectFormAbandoned } from "@/inngest/functions/crons/detect-form-abandoned";
import { detectLowMetrics } from "@/inngest/functions/crons/detect-low-metrics";
import { formSendWhatsappNotification } from "@/inngest/functions/form/send-whatsapp-notification";

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
    // ── ASTRO ──
    astroIngestKnowledge,
    astroAgentTrigger,
    // ── Chat sync ──
    chatSyncMessages,
    // ── Calendário Público: auto-resolução de reivindicações expiradas ──
    autoResolveExpiredClaims,
    // ── Forms: notificação WhatsApp ao submeter ──
    formSendWhatsappNotification,
    // ── Alerts: detecção time-based ──
    detectStaleLeads,
    detectBrokenIntegrations,
    detectAgendaStarting,
    detectFormAbandoned,
    detectLowMetrics,
    detectOverdue,
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
