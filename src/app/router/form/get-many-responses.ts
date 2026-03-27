import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getManyResponses = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/forms/:id/responses",
    summary: "Fetch all submissions for a given form",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const form = await prisma.form.findUnique({
      where: {
        id: input.id,
      },
      include: {
        formSubmissions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return {
      message: "Form responses fetched successfully",
      form,
    };
  });
