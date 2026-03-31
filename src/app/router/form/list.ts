import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const fetchForms = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/forms",
    summary: "Fetch all forms for the current user",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const organizationId = context.session.activeOrganizationId;

      if (!organizationId) {
        return {
          message: "No active organization found",
        };
      }

      const forms = await prisma.form.findMany({
        where: {
          organizationId,
        },
        include: {
          settings: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        message: "Forms fetched successfully",
        forms,
      };
    } catch (error) {
      return {
        message: "Failed to fetch forms",
        error,
      };
    }
  });
