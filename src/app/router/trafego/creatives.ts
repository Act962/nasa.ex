import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { deleteStoredObject } from "@/lib/s3-client";
import { assertOrderEditable } from "@/features/trafego/server/lib/assert-order-editable";
import { trafegoCreativeInputSchema } from "@/features/trafego/schema/trafego-schemas";

/** Registra um criativo já enviado ao R2. O upload em si é feito via /api/s3/*. */
export const addTrafegoCreative = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trafegoCreativeInputSchema)
  .handler(async ({ input, context }) => {
    const order = await assertOrderEditable(input.orderId, context.org.id);

    if (order.creativesCount >= order.maxCreatives) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Seu plano permite até ${order.maxCreatives} criativos.`,
      });
    }

    const last = await prisma.trafegoCreative.findFirst({
      where: { orderId: order.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return prisma.trafegoCreative.create({
      data: {
        orderId: order.id,
        kind: input.kind,
        fileKey: input.fileKey,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        durationSeconds: input.durationSeconds,
        position: (last?.position ?? -1) + 1,
        uploadedByUserId: context.user.id,
      },
      select: { id: true, position: true },
    });
  });

export const removeTrafegoCreative = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ creativeId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const creative = await prisma.trafegoCreative.findFirst({
      where: {
        id: input.creativeId,
        order: { organizationId: context.org.id },
      },
      select: { id: true, fileKey: true, orderId: true },
    });
    if (!creative) {
      throw new ORPCError("NOT_FOUND", { message: "Criativo não encontrado." });
    }

    await assertOrderEditable(creative.orderId, context.org.id);
    await prisma.trafegoCreative.delete({ where: { id: creative.id } });

    // Best-effort: o registro já saiu; um órfão no bucket não justifica erro.
    deleteStoredObject(creative.fileKey).catch(() => {});

    return { success: true };
  });
