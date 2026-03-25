import { v4 as uuidv4 } from "uuid";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  defaultBackgroundColor,
  defaultPrimaryColor,
} from "@/features/form/constants";
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

      const formSettings = await prisma.formSettings.delete({
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
