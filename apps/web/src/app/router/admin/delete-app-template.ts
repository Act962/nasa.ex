import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteAppTemplate = base
  .use(requireAdminMiddleware)
  .route({
    method: "POST",
    summary: "Admin — Unmark item as template",
    tags: ["Admin"],
  })
  .input(
    z.object({
      templateId: z.string(),
      appType: z.enum([
        "tracking",
        "workspace",
        "forge-proposal",
        "forge-contract",
        "form",
      ]),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const { templateId, appType } = input;
    const updateData = { isTemplate: false, templateMarkedByModerator: false };

    try {
      if (appType === "tracking") {
        await prisma.tracking.update({
          where: { id: templateId },
          data: updateData,
        });
      } else if (appType === "workspace") {
        await prisma.workspace.update({
          where: { id: templateId },
          data: updateData,
        });
      } else if (appType === "forge-proposal") {
        await prisma.forgeProposal.update({
          where: { id: templateId },
          data: updateData,
        });
      } else if (appType === "forge-contract") {
        await prisma.forgeContract.update({
          where: { id: templateId },
          data: updateData,
        });
      } else if (appType === "form") {
        await prisma.form.update({
          where: { id: templateId },
          data: updateData,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("[deleteAppTemplate] Error:", error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
