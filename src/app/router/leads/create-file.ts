import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

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
      const leadFile = await prisma.leadFile.create({
        data: {
          leadId: input.leadId,
          fileUrl: input.fileUrl,
          mimeType: input.mimeType,
          name: input.name,
          createdBy: context.user.id,
        },
      });

      return { leadFile };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
