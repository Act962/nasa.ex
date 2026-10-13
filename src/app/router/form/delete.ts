import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";

import prisma from "@/lib/prisma";
import z from "zod";

export const deleteForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/forms",
    summary: "Delete a form",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.NOT_FOUND({ message: "Form not found" });
    }

    // Formulário de outra empresa responde como inexistente, para não revelar que o id existe.
    const { count: deletedCount } = await prisma.form.deleteMany({
      where: { id: input.id, organizationId },
    });

    if (deletedCount === 0) {
      throw errors.NOT_FOUND({ message: "Form not found" });
    }

    return {
      message: "Form created successfully",
    };
  });
