import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

export const PublishForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/forms/:formId/publish",
    summary: "Toggle publish status of a form",
  })
  .input(
    z.object({
      id: z.string(),
      published: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { id, published } = input;

    const form = await prisma.form.update({
      where: { id },
      data: { published },
      select: { id: true, name: true, published: true, organizationId: true },
    });

    await logActivity({
      organizationId: form.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "forms",
      subAppSlug: "forms-builder",
      featureKey: published ? "forms.form.published" : "forms.form.unpublished",
      action: published ? "forms.form.published" : "forms.form.unpublished",
      actionLabel: published
        ? `Publicou o formulário "${form.name}"`
        : `Despublicou o formulário "${form.name}"`,
      resource: form.name,
      resourceId: form.id,
    });

    return {
      message: `Formulário ${published ? "publicado" : "despublicado"} com sucesso`,
      published: form.published,
    };
  });
