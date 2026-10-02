import "server-only";

import prisma from "@/lib/prisma";
import { clearProviderExhaustion } from "./provider-exhaustion";
import type { AiCreditEntryInput } from "./ai-credit-entry-schema";

/** Grava e remove lançamentos de crédito de um escopo (spec 0055, RF-1). */

export async function createAiCreditEntry(params: {
  organizationId: string | null;
  createdById: string;
  entry: AiCreditEntryInput;
}) {
  const created = await prisma.aiCreditEntry.create({
    data: {
      organizationId: params.organizationId,
      provider: params.entry.provider,
      kind: params.entry.kind,
      amountUsd: params.entry.amountUsd,
      effectiveAt: params.entry.effectiveAt ? new Date(params.entry.effectiveAt) : new Date(),
      note: params.entry.note || null,
      createdById: params.createdById,
    },
    select: { id: true },
  });
  clearProviderExhaustion({ organizationId: params.organizationId, provider: params.entry.provider });
  return created;
}

/** Só apaga lançamento do próprio escopo: um id de outra empresa não passa. */
export async function deleteAiCreditEntry(params: { organizationId: string | null; entryId: string }) {
  const deleted = await prisma.aiCreditEntry.deleteMany({
    where: { id: params.entryId, organizationId: params.organizationId },
  });
  return { deleted: deleted.count };
}
