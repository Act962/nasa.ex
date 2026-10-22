import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeWorkflow } from "@/inngest/functions";
import {
  pollingTicker5m,
  pollingTicker15m,
  pollingTickerHourly,
} from "@/inngest/functions/crons/polling-tickers";
import { executeWorkspaceWorkflow } from "@/inngest/functions/workspace-workflow-executor";
import { bookingNotification } from "@/inngest/functions/booking-notification";
import { processUserAction } from "@/inngest/functions/process-user-action";
import { detectAbsence } from "@/inngest/functions/crons/detect-absence";
import { markOverdueReceivablesCron } from "@/inngest/functions/crons/mark-overdue-receivables";
import { remindSalesApprovalsCron } from "@/inngest/functions/nerp-catalog/remind-sales-approvals";
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
import { starsMonthlyCycle } from "@/inngest/functions/crons/stars-monthly-cycle";
import { coursePublicPurchasePaid } from "@/inngest/functions/course-public-purchase-paid";
import { trafegoPurchasePaid } from "@/inngest/functions/trafego/purchase-paid";
import { trafegoOrderRequested } from "@/inngest/functions/trafego/order-requested";
import { trafegoOrderStatusChanged } from "@/inngest/functions/trafego/order-status-changed";
import { trafegoReleaseGenerate } from "@/inngest/functions/trafego/release-generate";
import { trafegoOrderCreated } from "@/inngest/functions/trafego/order-created";
import { trafegoAsaasPaymentEvent } from "@/inngest/functions/trafego/asaas-payment-event";
import { trafegoAsaasChargeWatch } from "@/inngest/functions/trafego/asaas-charge-watch";
import { publishPlannerPost, publishPlannerPostLegacy } from "@/inngest/functions/nasa-planner/publish-post";
import { plannerApprovalWhatsappNotify } from "@/inngest/functions/nasa-planner/approval-whatsapp-notify";
import {
  plannerBackfillPublishAccounts,
  plannerPublishAccountsHealth,
} from "@/inngest/functions/nasa-planner/publish-accounts-health";
import { refreshMetaTokens } from "@/inngest/functions/nasa-planner/refresh-meta-tokens";
import { socialChannelsDailyMaintenance } from "@/inngest/functions/social/channels-daily-maintenance";
import { syncPriceSuggestionsCron } from "@/inngest/functions/forge/sync-price-suggestions-cron";
import { syncMetaAdsKpis } from "@/inngest/functions/crons/sync-meta-ads-kpis";
import { astroLearnFromFeedback } from "@/inngest/functions/astro/learn-from-feedback";
import { astroChatPublicAgent } from "@/inngest/functions/astro-chat/public-agent";
import { astroChatMonthlyBilling } from "@/inngest/functions/astro-chat/monthly-billing";
import { salvyNumberMonthlyBilling } from "@/inngest/functions/campanhas/salvy-monthly-billing";
import { astroCommandRun } from "@/inngest/functions/astro-commander/run-command";
import { detectExpensesDueToday } from "@/inngest/functions/crons/detect-expenses-due-today";
import { detectComplianceDue } from "@/inngest/functions/crons/detect-compliance-due";
import { detectContractsExpiring } from "@/inngest/functions/crons/detect-contracts-expiring";
import { syncMetaAdsStructure } from "@/inngest/functions/crons/sync-meta-ads-structure";
import { nasaRouteSubscriptionRenew } from "@/inngest/functions/crons/nasa-route-subscription-renew";
import { nasaRouteVideoUploadsCleanup } from "@/inngest/functions/crons/nasa-route-video-uploads-cleanup";
import { nasaRouteCartRecoveryCron } from "@/inngest/functions/crons/nasa-route-cart-recovery";
import { onVideoUploadProgress } from "@/inngest/functions/nasa-route/on-video-upload-progress";
import { onVideoUploadCompleted } from "@/inngest/functions/nasa-route/on-video-upload-completed";
import { nasaRoutePurchaseEmail } from "@/inngest/functions/nasa-route/purchase-email";
import { astroIngestKnowledge } from "@/inngest/functions/astro/ingest-knowledge";
import { astroAgentTrigger } from "@/inngest/functions/astro/agent-trigger";
import { chatSyncMessages } from "@/inngest/functions/chat/sync-conversation-messages";
import { autoResolveExpiredClaims } from "@/inngest/functions/calendar/auto-resolve-expired-claims";
import {
  confirmDisconnectAndActivate,
  checkInChatRecovery,
} from "@/inngest/functions/chat/whatsapp-in-chat";
import { detectLowMetrics } from "@/inngest/functions/crons/detect-low-metrics";
import { snapshotMetaDailySpendCron } from "@/inngest/functions/campanhas/snapshot-meta-daily-spend";
import { formSendWhatsappNotification } from "@/inngest/functions/form/send-whatsapp-notification";
import { chatAiWhatsappAgent, chatAiWhatsappButtonClick } from "@/inngest/functions/chat-ai/whatsapp-agent";
import { syncCatalogOrderToNerp } from "@/inngest/functions/nerp-catalog/sync-order-to-nerp";
import { importErpCarteira } from "@/inngest/functions/erp-carteira/import-erp-carteira";
import { sendEmailCampaign } from "@/inngest/functions/campanhas/send-email-campaign";
import { awaitReplyTagCheck } from "@/inngest/functions/org-defaults/await-reply-tag";
import { attendanceCheck } from "@/inngest/functions/org-defaults/attendance-check";
import { appointmentWatch } from "@/inngest/functions/org-defaults/appointment-watch";
import { astroBotInactivityNotice } from "@/inngest/functions/astro-bot/inactivity-notice";
import { seedSampleContent } from "@/inngest/functions/org-defaults/seed-sample-content";
import { watchCatalogOrderPayment } from "@/inngest/functions/nerp-catalog/watch-order-payment";
import { starFriendsExpireStars } from "@/inngest/functions/star-friends/expire-stars";
import {
  scheduleIdleChecks,
  checkNoFirstResponse,
  checkInConvIdle,
} from "@/inngest/functions/triggers/idle-automation";
import { replicateUserToNerp } from "@/inngest/functions/sync/replicate-user-to-nerp";
import { replicateAccountToNerp } from "@/inngest/functions/sync/replicate-account-to-nerp";
import { replicateOrgToNerp } from "@/inngest/functions/sync/replicate-org-to-nerp";
import { replicateMemberToNerp } from "@/inngest/functions/sync/replicate-member-to-nerp";
import {
  // autoAgentTickScheduledFn,
  autoAgentOnLeadReplyFn,
} from "@/inngest/functions/auto-agent-scheduler";
import {
  agentTriggerPaymentReceivedFn,
  agentTriggerMessageIncomingFn,
  agentTriggerWebhookExternalFn,
  agentTriggerComplianceItemDueFn,
} from "@/inngest/functions/agent-workflow-triggers";
// ── NASA Payment Fase 2 (governança + cobrança event-driven) ──
import { paymentDunningFire }      from "@/inngest/functions/payment/dunning-fire";
import { paymentApprovalReminder } from "@/inngest/functions/payment/approval-reminder";
import { paymentGoalDailyCheck }    from "@/inngest/functions/payment/goal-daily-check";
import { paymentGoalWeeklySummary } from "@/inngest/functions/payment/goal-weekly-summary";
// ── Astro Financeiro (lembretes com boleto + caixa Gmail) ──
import { paymentReminderFire } from "@/inngest/functions/payment/reminder-fire";
import { paymentInboxSyncCron, paymentInboxSyncOrg } from "@/inngest/functions/payment/inbox-sync";
// ── Aba Contábil (spec 0051) ──
import {
  accountingJournalSync,
  accountingJournalBackfill,
  accountingNightly,
} from "@/inngest/functions/accounting/journal-sync";
// ── Campanhas (disparo em massa WhatsApp Oficial — Fase 3/4) ──
import { dispatchBroadcast } from "@/inngest/functions/campanhas/dispatch-broadcast";
import { watchScheduledBroadcast } from "@/inngest/functions/campanhas/watch-scheduled-broadcast";
import { syncSeiProcess } from "@/inngest/functions/sei/sync-process";
import { testSeiConnection } from "@/inngest/functions/sei/test-connection";
import {
  recomputeActiveLeadMetricsNightly,
  recomputeLeadMetrics,
} from "@/inngest/functions/leads/recompute-lead-metrics";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // ── Varreduras periódicas agrupadas (1 execução por tick) ──
    pollingTicker5m,
    pollingTicker15m,
    pollingTickerHourly,
    recomputeLeadMetrics,
    recomputeActiveLeadMetricsNightly,
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
    starsMonthlyCycle,
    // ── NASA Router (checkout público de curso) ──
    coursePublicPurchasePaid,
    trafegoPurchasePaid,
    trafegoOrderRequested,
    trafegoOrderStatusChanged,
    trafegoReleaseGenerate,
    trafegoOrderCreated,
    // ── trafeGO: evento de cobrança do Asaas (spec 0022) ──
    trafegoAsaasPaymentEvent,
    // ── trafeGO: acompanha cada cobrança PIX até resolver (spec 0022) ──
    trafegoAsaasChargeWatch,
    // ── ASTRO COMMANDER (spec 0028): execução (o agendamento roda no ticker de 5 min) ──
    astroLearnFromFeedback,
    astroChatPublicAgent,
    astroChatMonthlyBilling,
    salvyNumberMonthlyBilling,
    astroCommandRun,
    // ── ASTRO: alertas proativos (spec 0029) ──
    detectExpensesDueToday,
    detectContractsExpiring,
    detectComplianceDue,
    // ── NASA Planner ──
    publishPlannerPost,
    publishPlannerPostLegacy,
    plannerApprovalWhatsappNotify,
    plannerPublishAccountsHealth,
    socialChannelsDailyMaintenance,
    plannerBackfillPublishAccounts,
    refreshMetaTokens,
    // ── Meta Ads ──
    syncMetaAdsKpis,
    syncMetaAdsStructure,
    // ── NASA Route ──
    nasaRouteSubscriptionRenew,
    nasaRouteVideoUploadsCleanup,
    nasaRouteCartRecoveryCron,
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
    chatAiWhatsappButtonClick,
    // ── Catálogo online NERP → Órbita: pagamento e confirmação da venda ──
    watchCatalogOrderPayment,
    syncCatalogOrderToNerp,
    importErpCarteira,
    sendEmailCampaign,
    awaitReplyTagCheck,
    attendanceCheck,
    appointmentWatch,
    astroBotInactivityNotice,
    seedSampleContent,
    // ── STAR FRIENDS: validade das stars ──
    starFriendsExpireStars,
    // ── In-Chat (fallback anti-ban): confirma queda → ativa; recuperação preguiçosa ──
    confirmDisconnectAndActivate,
    checkInChatRecovery,
    // ── Calendário Público: auto-resolução de reivindicações expiradas ──
    autoResolveExpiredClaims,
    // ── Forms: notificação WhatsApp ao submeter ──
    formSendWhatsappNotification,
    // ── Alerts: detecção time-based ──
    detectLowMetrics,
    markOverdueReceivablesCron,
    remindSalesApprovalsCron,
    // ── Campanhas: gasto diário Meta ──
    snapshotMetaDailySpendCron,
    // ── Idle automation por tracking (substitui detect-leads-waiting-attention + LAST_INBOUND_TIMEOUT) ──
    scheduleIdleChecks,
    checkNoFirstResponse,
    checkInConvIdle,
    // ── Sync auth NASA → NERP ──
    replicateUserToNerp,
    replicateAccountToNerp,
    replicateOrgToNerp,
    replicateMemberToNerp,
    // ── NASA Auto Agent — scheduler de turns assíncronos ──
    // autoAgentTickScheduledFn,
    autoAgentOnLeadReplyFn,
    // ── Modo Agente IA Visual — disparadores dos triggers novos ──
    agentTriggerPaymentReceivedFn,
    agentTriggerMessageIncomingFn,
    agentTriggerWebhookExternalFn,
    agentTriggerComplianceItemDueFn,
    // ── NASA Payment Fase 2 — event-driven, sem cron ──
    paymentDunningFire,
    paymentApprovalReminder,
    paymentGoalDailyCheck,
    paymentGoalWeeklySummary,
    // ── Astro Financeiro — lembrete com boleto (event) + caixa Gmail (cron 30 min) ──
    paymentReminderFire,
    paymentInboxSyncCron,
    paymentInboxSyncOrg,
    // ── Aba Contábil — journal derivado + reconciliação noturna ──
    accountingJournalSync,
    accountingJournalBackfill,
    accountingNightly,
    // ── Campanhas — disparo em massa (Fase 3) + agendamento (Fase 4, cron) ──
    dispatchBroadcast,
    // Disparo agendado por campanha — caminho principal; a rede fica no ticker de 15 min.
    watchScheduledBroadcast,
    // ── SEI — consultas SOAP fora do ciclo das rotas HTTP ──
    syncSeiProcess,
    testSeiConnection,
    // bookingNotification,
    // processUserAction,
    // detectAbsence,
    // detectOverdue,
    // detectChatTimeout,
    // checkStreaks,
    // checkMilestones,
    // onProposalPaid,
    // onOnboardingFormsCompleted,
    // ── FORGE (simulador de custos: sync de preços suggest-only) ──
    syncPriceSuggestionsCron,
  ],
});
