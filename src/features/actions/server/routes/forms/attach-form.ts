/** Anexa um formulário publicado da org à pauta de uma tarefa (spec 0002, RF-7). */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";
import { resolveActionAccess } from "@/features/actions/server/lib/can-edit-action";

export const attachFormToAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), formId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const access = await resolveActionAccess(input.actionId, {
      userId: context.user.id,
      org: context.org,
    });

    if (!access) {
      throw errors.NOT_FOUND({ message: "Tarefa não encontrada" });
    }
    if (!access.canEdit) {
      throw errors.FORBIDDEN({
        message: "Você não pode editar esta tarefa",
      });
    }

    const form = await prisma.form.findFirst({
      where: { id: input.formId, organizationId: context.org.id },
      select: { id: true, name: true },
    });
    if (!form) {
      throw errors.NOT_FOUND({ message: "Formulário não encontrado" });
    }

    const lastInPauta = await prisma.actionForm.findFirst({
      where: { actionId: input.actionId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const actionForm = await prisma.actionForm.upsert({
      where: {
        actionId_formId: { actionId: input.actionId, formId: form.id },
      },
      create: {
        actionId: input.actionId,
        formId: form.id,
        order: (lastInPauta?.order ?? -1) + 1,
        attachedBy: context.user.id,
      },
      update: {},
      select: { formId: true, order: true },
    });

    return { actionForm, form };
  });
