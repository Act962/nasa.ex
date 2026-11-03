import "server-only";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { DAY_MS } from "@/features/payment/lib/dates";

// RF-9: o certificado do banco vale 1 ano e, vencido, a baixa automática para sem barulho.
// Avisa dono e administradores aos 90, 30 e 7 dias, uma vez em cada marco.

const ALERT_THRESHOLDS_DAYS = [7, 30, 90] as const;

export async function alertExpiringBankCertificates(): Promise<{ alerted: number }> {
  const horizon = new Date(Date.now() + ALERT_THRESHOLDS_DAYS[ALERT_THRESHOLDS_DAYS.length - 1] * DAY_MS);
  const connections = await prisma.paymentBankConnection.findMany({
    where: { certificateValidTo: { lte: horizon }, account: { isActive: true } },
    select: {
      id: true,
      organizationId: true,
      certificateValidTo: true,
      certificateAlertDays: true,
      account: { select: { name: true } },
    },
    take: 200,
  });

  let alerted = 0;
  for (const connection of connections) {
    if (!connection.certificateValidTo) continue;
    const daysLeft = Math.ceil((connection.certificateValidTo.getTime() - Date.now()) / DAY_MS);
    const threshold = ALERT_THRESHOLDS_DAYS.find((days) => daysLeft <= days);
    if (!threshold) continue;
    if (connection.certificateAlertDays !== null && connection.certificateAlertDays <= threshold) continue;

    const isExpired = daysLeft <= 0;
    await dispatchAlert(
      "integration.bank_certificate_expiring",
      { connectionId: connection.id, orgId: connection.organizationId, daysLeft },
      {
        bypassRules: {
          title: isExpired ? "Certificado do banco vencido" : `Certificado do banco vence em ${daysLeft} dias`,
          body: isExpired
            ? `A conta "${connection.account.name}" voltou ao PIX sem baixa automática. Gere um certificado novo no banco e troque em Financeiro → Contas.`
            : `Gere um certificado novo no banco e troque em Financeiro → Contas, na conta "${connection.account.name}", para a baixa automática não parar.`,
          severity: isExpired || threshold === 7 ? "critical" : "warning",
          audience: { kind: "org_admins" },
          actionUrl: "/payment?tab=accounts",
          orgId: connection.organizationId,
          createdBy: "system",
        },
      },
    );
    await prisma.paymentBankConnection.update({
      where: { id: connection.id },
      data: { certificateAlertDays: isExpired ? 0 : threshold },
    });
    alerted += 1;
  }
  return { alerted };
}
