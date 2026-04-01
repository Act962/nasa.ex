import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const removeFileAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      attachmentId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { actionId, attachmentId } = input;
      const existingAction = await prisma.action.findUnique({
        where: { id: actionId },
        select: { history: true, attachments: true },
      });

      if (!existingAction) {
        throw errors.NOT_FOUND({ message: "Action not found" });
      }

      const currentAttachments = Array.isArray(existingAction.attachments)
        ? existingAction.attachments
        : [];

      const updatedAttachments = currentAttachments.filter(
        (att: any) => att.url !== attachmentId,
      );

      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/s3/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: attachmentId,
        }),
      });

      const action = await prisma.action.update({
        where: { id: actionId },
        data: { attachments: updatedAttachments },
      });
      return { action };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
