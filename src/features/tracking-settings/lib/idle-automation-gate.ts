import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";

/**
 * Gate de dispatch: só emite `idle/lead-activity` quando existe config ativa
 * pra esse tracking. Evita invocar `scheduleIdleChecks` (e consumir step do
 * Inngest) quando o usuário não configurou nada / desligou tudo.
 *
 * Custo: 1 query indexada por unique (`trackingId`) no Postgres. Bem mais
 * barata que invocar uma função Inngest pra ela retornar {scheduled:0}.
 */
export async function dispatchIdleActivityIfActive(args: {
  leadId: string;
  trackingId: string;
  organizationId: string;
}): Promise<void> {
  const config = await prisma.trackingIdleAutomation.findUnique({
    where: { trackingId: args.trackingId },
    select: { noFirstRespActive: true, inConvActive: true },
  });

  if (!config) return;
  if (!config.noFirstRespActive && !config.inConvActive) return;

  await inngest.send({
    name: "idle/lead-activity",
    data: {
      leadId: args.leadId,
      trackingId: args.trackingId,
      organizationId: args.organizationId,
    },
  });
}
