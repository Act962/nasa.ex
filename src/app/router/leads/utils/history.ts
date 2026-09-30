import type { Prisma } from "@/generated/prisma/client";
import { LeadAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

type PrismaTx = Prisma.TransactionClient;

interface RecordLeadHistory {
  leadId: string;
  userId: string;
  action: LeadAction;
  notes?: string;
  reasonId?: string;
  tx?: PrismaTx;
}

export async function recordLeadHistory({
  leadId,
  userId,
  action,
  notes,
  reasonId,
  tx,
}: RecordLeadHistory) {
  const client = tx || prisma;

  return await client.leadHistory.create({
    data: {
      leadId,
      userId,
      action,
      notes,
      reasonId,
    },
  });
}
