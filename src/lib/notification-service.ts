import "server-only";

import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";

export const NOTIF_TYPES = {
  NEW_LEAD:             "NEW_LEAD",
  AI_TOKEN_ALERT:       "AI_TOKEN_ALERT",
  STARS_ALERT:          "STARS_ALERT",
  CARD_EDIT:            "CARD_EDIT",
  APPOINTMENT_REMINDER: "APPOINTMENT_REMINDER",
  INSIGHTS_MOVEMENT:    "INSIGHTS_MOVEMENT",
  PLAN_EXPIRY:          "PLAN_EXPIRY",
  ADMIN_MESSAGE:        "ADMIN_MESSAGE",
  CUSTOM:               "CUSTOM",
} as const;

export type NotifType = (typeof NOTIF_TYPES)[keyof typeof NOTIF_TYPES];

export const NOTIF_META: Record<NotifType, { label: string; appKey: string; description: string }> = {
  NEW_LEAD:             { label: "Novo Lead",                   appKey: "tracking",       description: "Quando um novo lead chegar no CRM/Chat" },
  AI_TOKEN_ALERT:       { label: "Alerta de Tokens IA",         appKey: "insights",       description: "Consumo alto de tokens das integrações com IA" },
  STARS_ALERT:          { label: "Alerta de Stars",             appKey: "stars",          description: "Saldo de Stars baixo na empresa" },
  CARD_EDIT:            { label: "Edição de Card/Tarefa",       appKey: "explorer",       description: "Cards/tarefas editados onde você é responsável ou participante" },
  APPOINTMENT_REMINDER: { label: "Lembrete de Agendamento",     appKey: "spacetime",      description: "Agendamentos próximos do vencimento" },
  INSIGHTS_MOVEMENT:    { label: "Movimentação de Insights",    appKey: "insights",       description: "Novos eventos nos dashboards de insights" },
  PLAN_EXPIRY:          { label: "Vencimento de Plano",         appKey: "billing",        description: "Plano da empresa próximo do vencimento" },
  ADMIN_MESSAGE:        { label: "Mensagem do Admin",           appKey: "admin",          description: "Comunicados enviados pelos administradores da plataforma" },
  CUSTOM:               { label: "Notificação Personalizada",   appKey: "custom",         description: "Alertas e lembretes configurados manualmente" },
};

interface CreateNotificationOptions {
  userId:         string;
  organizationId?: string;
  type:           NotifType;
  title:          string;
  body:           string;
  appKey?:        string;
  actionUrl?:     string;
  metadata?:      Record<string, unknown>;
}

/**
 * Creates an in-app notification and optionally sends via WhatsApp
 * if the user has that preference enabled.
 */
export async function createNotification(opts: CreateNotificationOptions) {
  const { userId, organizationId, type, title, body, appKey, actionUrl, metadata } = opts;

  // Check preference: should we create in-app + maybe WhatsApp?
  let sendWA = false;
  if (organizationId) {
    const pref = await prisma.userNotificationPreference.findUnique({
      where: { userId_organizationId_notifType: { userId, organizationId, notifType: type } },
      select: { inApp: true, whatsApp: true },
    });
    // Default: inApp=true, whatsApp=false
    const inApp = pref?.inApp ?? true;
    sendWA = pref?.whatsApp ?? false;

    if (!inApp && !sendWA) return null; // user opted out completely
  }

  const notif = await prisma.adminNotification.create({
    data: {
      targetType: "user",
      targetId: userId,
      organizationId: organizationId ?? null,
      type,
      title,
      body,
      appKey: appKey ?? NOTIF_META[type as NotifType]?.appKey ?? null,
      actionUrl: actionUrl ?? null,
      metadata: metadata ? (metadata as object) : undefined,
      createdBy: "SYSTEM",
      sentWhatsApp: false,
    },
    select: { id: true },
  });

  // WhatsApp delivery
  if (sendWA && organizationId) {
    try {
      await sendWhatsAppNotification({ userId, organizationId, title, body });
      await prisma.adminNotification.update({
        where: { id: notif.id },
        data: { sentWhatsApp: true },
      });
    } catch {
      // Non-blocking — WhatsApp failure doesn't fail the notification
    }
  }

  return notif;
}


/**
 * Sends a WhatsApp message using the org's connected WhatsApp instance.
 * Uses the user's phone from their tracking profile (if available).
 */
async function sendWhatsAppNotification({
  userId,
  organizationId,
  title,
  body,
}: {
  userId: string;
  organizationId: string;
  title: string;
  body: string;
}) {
  // Get org's active WhatsApp instance
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { organizationId, isActive: true, status: "CONNECTED" },
    select: { apiKey: true, baseUrl: true },
  });
  if (!instance) return;

  // Get user's phone from a lead they are responsible for in this org
  const lead = await prisma.lead.findFirst({
    where: {
      tracking: { organizationId },
      responsibleId: userId,
      phone: { not: null },
    },
    select: { phone: true },
  });

  const phone = lead?.phone;
  if (!phone) return;

  const text = `*${title}*\n\n${body}\n\n_NASA.ex Platform_`;

  await sendText(instance.apiKey, { number: phone, text }, instance.baseUrl);
}

/**
 * Bulk create notifications for all users in an org using broadcast.
 */
export async function createOrgNotification({
  organizationId,
  type,
  title,
  body,
  appKey,
  actionUrl,
  metadata,
}: {
  organizationId: string;
  type:           NotifType;
  title:          string;
  body:           string;
  appKey?:        string;
  actionUrl?:     string;
  metadata?:      Record<string, unknown>;
}) {
  // Create BROADCAST notification (one row for all members)
  const notif = await prisma.adminNotification.create({
    data: {
      targetType: "org",
      targetId: organizationId,
      organizationId,
      type,
      title,
      body,
      appKey: appKey ?? NOTIF_META[type as NotifType]?.appKey ?? null,
      actionUrl: actionUrl ?? null,
      metadata: metadata ? (metadata as object) : undefined,
      createdBy: "SYSTEM",
      sentWhatsApp: false,
    },
    select: { id: true },
  });

  // For WhatsApp, we still need to check preferences and send individually
  const membersWithWAPref = await prisma.userNotificationPreference.findMany({
    where: { 
      organizationId, 
      notifType: type, 
      whatsApp: true 
    },
    select: { userId: true }
  });

  if (membersWithWAPref.length > 0) {
    await Promise.allSettled(
      membersWithWAPref.map(async (m) => {
        try {
          await sendWhatsAppNotification({ userId: m.userId, organizationId, title, body });
        } catch {
          // ignore failures
        }
      })
    );
    
    await prisma.adminNotification.update({
      where: { id: notif.id },
      data: { sentWhatsApp: true }
    });
  }

  return notif;
}

