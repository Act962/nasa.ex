import "server-only";

import prisma from "@/lib/prisma";
import { registerCreditsFromAttachment } from "./register-credit-from-attachment";
import { refreshCreditStatuses } from "./refresh-credit-statuses";

const REPROCESS_MONTHS = 6;
const REPROCESS_LIMIT = 400;

/** Varre as notas anexadas nos últimos 6 meses e registra os créditos que faltarem. */
export async function reprocessCredits(organizationId: string) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - REPROCESS_MONTHS);

  const attachments = await prisma.paymentAttachment.findMany({
    where: {
      organizationId,
      createdAt: { gte: since },
      OR: [{ kind: "NOTA_FISCAL" }, { mimeType: { in: ["application/xml", "text/xml"] } }],
    },
    orderBy: { createdAt: "asc" },
    take: REPROCESS_LIMIT,
    select: { id: true, fileKey: true },
  });

  // Parcelas compartilham o arquivo (cópias do anexo): lê cada nota uma vez, pelo original (o mais antigo).
  const seenFileKeys = new Set<string>();
  let registeredCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  for (const attachment of attachments) {
    if (seenFileKeys.has(attachment.fileKey)) continue;
    seenFileKeys.add(attachment.fileKey);
    try {
      const result = await registerCreditsFromAttachment({ organizationId, attachmentId: attachment.id });
      if (result.status === "registered") registeredCount += 1;
      else skippedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error("[accounting/credits reprocess]", attachment.id, error);
    }
  }
  await refreshCreditStatuses(organizationId);

  return { scannedCount: seenFileKeys.size, registeredCount, skippedCount, failedCount };
}
