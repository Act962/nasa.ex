import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { isFormPolicyManager } from "@/features/form/lib/can-edit-response";

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

      // Quem pode alterar a política de edição de respostas (spec 0005, D-13).
      // Resolvido no servidor pelo mesmo motivo do RF-12: a UI não re-deriva
      // regra de permissão — só renderiza o que o servidor disser.
      const canEditPolicy = await isFormPolicyManager({
        userId: context.user.id,
        organizationId: form.organizationId,
        formTrackingId: form.settings?.trackingId ?? null,
      });

      return {
        message: "Form fetched successfully",
        form,
        canEditPolicy,
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
