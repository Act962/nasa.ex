import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";

import prisma from "@/lib/prisma";
import z from "zod";

export const deleteForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/forms",
    summary: "Create a new form",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { id } = input;

      const formFind = await prisma.form.findUnique({
        where: {
          id,
        },
      });

      if (!formFind) {
        throw errors.NOT_FOUND({ message: "Form not found" });
      }

      await prisma.form.delete({
        where: {
          id,
        },
      });

      return {
        message: "Form created successfully",
      };
    } catch (err) {
      console.log(err);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
