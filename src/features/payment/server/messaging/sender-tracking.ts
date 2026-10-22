import "server-only";
import prisma from "@/lib/prisma";

/** Tracking cujo número envia a régua e os lembretes do financeiro (spec 0115). null = número mais antigo da org. */
export async function getPaymentSenderTrackingId(organizationId: string): Promise<string | null> {
  const config = await prisma.paymentGovernanceConfig.findUnique({
    where: { organizationId },
    select: { messagingTrackingId: true },
  });
  return config?.messagingTrackingId ?? null;
}
