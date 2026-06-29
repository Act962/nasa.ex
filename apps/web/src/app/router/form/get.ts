import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const fetchFormById = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/forms/:id",
    summary: "Fetch a single form by ID",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { id } = input;
      const organizationId = context.session.activeOrganizationId;

      if (!organizationId) {
        throw errors.BAD_REQUEST({ message: "Organization not found" });
      }

      const form = await prisma.form.findFirst({
        where: {
          id: id,
        },
        include: {
          settings: true,
        },
      });

      if (!form) {
        throw errors.NOT_FOUND({ message: "Form not found" });
      }

      return {
        message: "Form fetched successfully",
        form,
      };
    } catch (error: any) {
      console.error("Error fetching form:", error);
      if (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST") {
        throw error;
      }
      throw errors.INTERNAL_SERVER_ERROR({
        message: error?.message || "Internal server error",
      });
    }
  });
