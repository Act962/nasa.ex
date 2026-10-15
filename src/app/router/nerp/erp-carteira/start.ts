import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import {
  ERP_CARTEIRA_IMPORT_EVENT,
  type ErpCarteiraImportEvent,
} from "@/features/erp-carteira/server/run-import";
import { getNerpConfig } from "../_helpers";
import { requireOrgAdmin } from "../_access";

// Spec 0106 (RF-3): só admin importa a carteira; o destino (funil e etapa) fica salvo para a atualização diária.
export const startErpCarteiraImport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string().min(1), statusId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const organizationId = context.org.id;
    await requireOrgAdmin(organizationId, context.user.id);
    await getNerpConfig(organizationId);

    const status = await prisma.status.findFirst({
      where: { id: input.statusId, trackingId: input.trackingId, tracking: { organizationId } },
      select: { id: true },
    });
    if (!status) {
      throw new ORPCError("BAD_REQUEST", { message: "Etapa não pertence a este funil." });
    }

    const current = await prisma.erpCarteiraImport.findUnique({
      where: { organizationId },
      select: { status: true },
    });
    if (current?.status === "running") {
      throw new ORPCError("CONFLICT", { message: "A importação já está em andamento." });
    }

    await prisma.erpCarteiraImport.upsert({
      where: { organizationId },
      create: {
        organizationId,
        trackingId: input.trackingId,
        statusId: input.statusId,
        createdById: context.user.id,
        status: "queued",
      },
      update: {
        trackingId: input.trackingId,
        statusId: input.statusId,
        createdById: context.user.id,
        status: current?.status === "failed" ? "failed" : "queued",
      },
    });

    const eventData: ErpCarteiraImportEvent = { organizationId, mode: "full" };
    await inngest.send({ name: ERP_CARTEIRA_IMPORT_EVENT, data: eventData });
    return { queued: true };
  });
