import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const submitResponse = base
  .route({
    method: "POST",
    path: "/forms/public/:id/submit",
    summary: "Submit a response to a published form",
  })
  .input(
    z.object({
      id: z.string(),
      response: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const { id, response } = input;

      await prisma.form.update({
        where: {
          id,
          published: true,
        },
        data: {
          formSubmissions: {
            create: {
              jsonReponse: response,
            },
          },
          responses: {
            increment: 1,
          },
        },
      });

      return {
        id,
        message: "Response submitted",
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
