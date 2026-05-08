import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { recordLeadEvent } from "@/features/leads/lib/history";

export const deleteLeadFile = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    path: "/leads/{leadId}/files/{fileId}",
    summary: "Delete a lead file",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      fileId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      await prisma.$transaction(async (tx) => {
        const file = await tx.leadFile.findFirst({
          where: { id: input.fileId, leadId: input.leadId },
          select: { id: true, name: true },
        });
        if (!file) throw errors.NOT_FOUND;

        await tx.leadFile.delete({ where: { id: file.id } });

        await recordLeadHistory({
          leadId: input.leadId,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: `Arquivo removido: ${file.name}`,
          tx,
        });

        await recordLeadEvent(
          {
            leadId: input.leadId,
            eventType: "FILE_UPLOADED",
            userId: context.user.id,
            notes: `Removido: ${file.name}`,
            metadata: { action: "removed", fileId: file.id, name: file.name },
          },
          tx,
        );
      });

      return { ok: true };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
