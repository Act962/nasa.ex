import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

export const createLeadFile = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/leads/:leadId/files",
    summary: "Create a new lead file",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      fileUrl: z.string(),
      mimeType: z.string(),
      name: z.string(),
      createdBy: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const leadFile = await tx.leadFile.create({
          data: {
            leadId: input.leadId,
            fileUrl: input.fileUrl,
            mimeType: input.mimeType,
            name: input.name,
            createdBy: context.user.id,
          },
        });

        await recordLeadHistory({
          leadId: input.leadId,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: `Arquivo adicionado: ${input.name}`,
          tx,
        });

        return { leadFile };
      });

      return result;
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
