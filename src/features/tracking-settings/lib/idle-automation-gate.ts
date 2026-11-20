import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";

// Agenda as checagens de ociosidade direto daqui (antes passava por uma função
// intermediária a cada mensagem). O `id` do evento leva a janela de tempo do
// cenário: mensagens do cliente dentro da mesma janela viram uma checagem só, e
// quem insiste depois dela agenda outra (que só age se ainda ninguém respondeu).
export async function dispatchIdleActivityIfActive(args: {
  leadId: string;
  trackingId: string;
  organizationId: string;
}): Promise<void> {
  const config = await prisma.trackingIdleAutomation.findUnique({
    where: { trackingId: args.trackingId },
    select: { noFirstRespActive: true, noFirstRespMinutes: true, inConvActive: true, inConvMinutes: true },
  });
  if (!config) return;
  if (!config.noFirstRespActive && !config.inConvActive) return;
  if (isAttendanceStateEnabled(args.organizationId)) return;

  const lead = await prisma.lead.findUnique({
    where: { id: args.leadId },
    select: {
      firstResponseAt: true,
      lastInboundAt: true,
      lastOutboundAt: true,
      statusFlow: true,
      conversation: { select: { id: true } },
    },
  });
  if (!lead || lead.statusFlow === "FINISHED") return;

  const baseData = {
    leadId: args.leadId,
    trackingId: args.trackingId,
    organizationId: args.organizationId,
    conversationId: lead.conversation?.id ?? null,
    originalLastInboundAt: lead.lastInboundAt?.toISOString() ?? null,
  };
  const now = Date.now();
  const windowIndexOf = (minutes: number) => Math.floor(now / (Math.max(1, minutes) * 60_000));

  if (config.noFirstRespActive && lead.firstResponseAt === null) {
    await inngest.send({
      id: `idle-no-first-response:${args.leadId}:${windowIndexOf(config.noFirstRespMinutes)}`,
      name: "idle/check-no-first-response",
      data: {
        ...baseData,
        originalLastOutboundAt: null,
        fireAt: new Date(now + config.noFirstRespMinutes * 60_000).toISOString(),
      },
    });
    return;
  }

  if (config.inConvActive && lead.firstResponseAt !== null) {
    const lastOutboundIso = lead.lastOutboundAt?.toISOString() ?? null;
    await inngest.send({
      id: `idle-in-conv:${args.leadId}:${lastOutboundIso ?? "none"}:${windowIndexOf(config.inConvMinutes)}`,
      name: "idle/check-in-conv-idle",
      data: {
        ...baseData,
        originalLastOutboundAt: lastOutboundIso,
        fireAt: new Date(now + config.inConvMinutes * 60_000).toISOString(),
      },
    });
  }
}
