import { v4 as uuidv4 } from "uuid";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  defaultBackgroundColor,
  defaultPrimaryColor,
} from "@/features/form/constants";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

export const createForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/forms",
    summary: "Create a new form",
  })
  .input(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      trackingId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { name, description, trackingId } = input;
    const organizationId = context.session.activeOrganizationId;

    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organization not found" });
    }

    const jsonBlock = JSON.stringify([
      // {
      //   blockType: "RowLayout",
      //   attributes: {},
      //   isLocked: true,
      //   childblocks: [
      //     {
      //       blockType: "Heading",
      //       attributes: {
      //         label: name || "Formulário sem título",
      //         level: 1,
      //         fontSize: "4x-large",
      //         fontWeight: "normal",
      //       },
      //     },
      //     {
      //       blockType: "Paragraph",
      //       attributes: {
      //         label: "Paragraph",
      //         text: description || "Adicione uma descrição aqui.",
      //         fontSize: "small",
      //         fontWeight: "normal",
      //       },
      //     },
      //   ],
      // },
    ]);

    const form = await prisma.form.create({
      data: {
        name,
        description,
        userId: context.user.id,
        organizationId,
        ...(trackingId && { trackingId }),
        jsonBlock,
        content: jsonBlock,
        shareUrl: uuidv4(),
        settings: {
          create: {
            primaryColor: defaultPrimaryColor,
            backgroundColor: defaultBackgroundColor,
          },
        },
      },
    });

    await logActivity({
      organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "forms",
      subAppSlug: "forms-builder",
      featureKey: "forms.form.created",
      action: "forms.form.created",
      actionLabel: `Criou o formulário "${form.name}"`,
      resource: form.name,
      resourceId: form.id,
      metadata: { hasTracking: !!trackingId },
    });

    return {
      message: "Formulário criado com sucesso",
      form,
    };
  });
