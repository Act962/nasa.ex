import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getPublic = base
  .route({
    method: "GET",
    path: "/forms/public/:formId",
    summary: "Fetch a published form by its formId (public route)",
  })
  .input(
    z.object({
      formId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const form = await prisma.form.findFirst({
      where: {
        formId: input.formId,
        published: true,
      },
      include: {
        settings: true,
      },
    });

    if (!form) {
      throw new Error("Form not found");
    }

    return {
      message: "Form fetched successfully",
      form,
    };
  });
