import { NextResponse } from "next/server";
import { verifyNerpRequest } from "@/features/nerp-catalog/lib/verify-nerp-request";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  ERP_CARTEIRA_IMPORT_EVENT,
  isImportInProgress,
  type ErpCarteiraImportEvent,
} from "@/features/erp-carteira/server/run-import";

// Spec 0106 (RF-7): o NERP avisa que a sincronização diária do Winthor terminou.
// Só reimporta quem já fez a primeira carga; importação em andamento não é atropelada.
export async function POST(request: Request) {
  const verification = await verifyNerpRequest(request);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 401 });
  }
  const { organizationId } = verification.value;

  const record = await prisma.erpCarteiraImport.findUnique({
    where: { organizationId },
    select: { status: true, lastFullAt: true, updatedAt: true },
  });
  if (!record?.lastFullAt || isImportInProgress(record)) {
    return NextResponse.json({ queued: false });
  }

  const eventData: ErpCarteiraImportEvent = { organizationId, mode: "refresh" };
  await inngest.send({ name: ERP_CARTEIRA_IMPORT_EVENT, data: eventData });
  return NextResponse.json({ queued: true });
}
