import "server-only";
import prisma from "@/lib/prisma";
import { createNotification } from "@/features/admin/lib/notification-service";
import { resolveOrgAdmins } from "@/features/alerts/lib/audience-resolver";
import { resolveNoticeChannel } from "@/features/astro-bot/lib/member-notice-channel";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";

// Aviso de cliente sem atendimento humano ao dono e aos números liberados (spec 0113, RF-12). Sino e push
// sempre; WhatsApp só pelo número liberado do Astro e só fora da API oficial, onde mensagem para quem não
// escreveu nas últimas 24 h exige modelo aprovado da empresa.

export const MAX_OWNER_WHATSAPP_NOTICES = 3;

export async function notifyUnattendedLead(params: {
  organizationId: string;
  leadId: string;
  conversationId: string;
  noticeNumber: number;
  waitingMinutes: number;
}): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { name: true, phone: true, responsibleId: true, tracking: { select: { name: true } } },
  });
  if (!lead) return;

  const leadLabel = lead.name && lead.name !== "Sem nome" ? lead.name : (lead.phone ?? "Um cliente");
  const isFinalNotice = params.noticeNumber > MAX_OWNER_WHATSAPP_NOTICES;
  const body = isFinalNotice
    ? `${leadLabel} segue sem atendimento humano no funil ${lead.tracking.name}. A IA continua respondendo.`
    : `${leadLabel} está esperando atendimento há ${params.waitingMinutes} min no funil ${lead.tracking.name}. A IA está respondendo por enquanto.`;
  const actionUrl = `/tracking-chat/${params.conversationId}`;

  const adminIds = await resolveOrgAdmins(params.organizationId);
  const recipientIds = [...new Set([...(lead.responsibleId ? [lead.responsibleId] : []), ...adminIds])];

  for (const userId of recipientIds) {
    await createNotification({
      userId,
      organizationId: params.organizationId,
      type: "LEAD_AWAITING_ATTENTION",
      title: "Cliente esperando atendimento",
      body,
      appKey: "tracking",
      actionUrl,
      severity: "warning",
      skipWhatsApp: true,
    }).catch((error: unknown) => console.warn("[attendance] aviso no sino falhou", error));

    if (isFinalNotice) continue;
    // Quem desligou o WhatsApp deste aviso nas preferências não recebe.
    const preference = await prisma.userNotificationPreference.findUnique({
      where: { userId_organizationId_notifType: { userId, organizationId: params.organizationId, notifType: "LEAD_AWAITING_ATTENTION" } },
      select: { whatsApp: true },
    });
    if (preference && !preference.whatsApp) continue;
    const channel = await resolveNoticeChannel({ userId, organizationId: params.organizationId }).catch(() => null);
    if (!channel) continue;
    const resolved = await resolveOutboundProvider(channel.trackingId).catch(() => null);
    if (!resolved || resolved.providerId === "meta-cloud") continue;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await resolved.provider
      .sendText({ kind: "text", to: channel.phone, body: `*Cliente esperando atendimento*\n\n${body}\n\nAbrir: ${appUrl}${actionUrl}` })
      .catch((error: unknown) => console.warn("[attendance] aviso por WhatsApp falhou", error));
  }
}
