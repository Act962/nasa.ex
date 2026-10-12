import "server-only";
import prisma from "@/lib/prisma";
import { createNotification } from "@/features/admin/lib/notification-service";

// Campanha agendada que não saiu por falta de crédito (spec 0087, Parte F): quem agendou é avisado,
// no máximo uma vez por dia por campanha. Sem o aviso, a campanha ficava parada e ninguém sabia.

const NOTICE_INTERVAL_MS = 24 * 60 * 60_000;

/** Nunca lança: falha no aviso não pode atrapalhar o agendador. */
export async function notifyBroadcastDeferredWithoutCredit(broadcastId: string): Promise<void> {
  try {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { name: true, organizationId: true, createdById: true },
    });
    if (!broadcast) return;
    const recentNotice = await prisma.adminNotification.findFirst({
      where: {
        type: "STARS_ALERT",
        targetId: broadcast.createdById,
        organizationId: broadcast.organizationId,
        createdAt: { gte: new Date(Date.now() - NOTICE_INTERVAL_MS) },
        metadata: { path: ["deferredBroadcastId"], equals: broadcastId },
      },
      select: { id: true },
    });
    if (recentNotice) return;
    await createNotification({
      userId: broadcast.createdById,
      organizationId: broadcast.organizationId,
      type: "STARS_ALERT",
      title: "Campanha agendada não saiu: empresa sem Stars",
      body: `A campanha "${broadcast.name}" está parada porque a empresa está sem crédito (Stars). Ela sai sozinha depois da recarga.`,
      actionUrl: "/campanhas",
      severity: "warning",
      metadata: { deferredBroadcastId: broadcastId },
    });
  } catch (noticeError) {
    console.warn("[campanhas] aviso de campanha adiada falhou", noticeError instanceof Error ? noticeError.message.slice(0, 200) : "erro");
  }
}
