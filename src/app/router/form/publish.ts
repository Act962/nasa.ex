import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const PublishForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/forms/:formId/publish",
    summary: "Toggle publish status of a form",
  })
  .input(
    z.object({
      formId: z.string(),
      published: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const { formId, published } = input;

    const form = await prisma.form.update({
      where: { formId },
      data: { published },
    });

    return {
      message: `Form successfully ${published ? "published" : "unpublished"}`,
      published: form.published,
    };
  });
