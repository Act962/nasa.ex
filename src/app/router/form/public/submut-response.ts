import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const submitResponse = base
  .route({
    method: "POST",
    path: "/forms/public/:formId/submit",
    summary: "Submit a response to a published form",
  })
  .input(
    z.object({
      formId: z.string(),
      response: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { formId, response } = input;

    await prisma.form.update({
      where: {
        formId,
        published: true,
      },
      data: {
        formSubmissions: {
          create: {
            content: response,
          },
        },
        responses: {
          increment: 1,
        },
      },
    });

    return {
      formId,
      message: "Response submitted",
    };
  });
