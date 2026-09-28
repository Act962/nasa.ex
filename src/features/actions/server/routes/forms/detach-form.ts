/**
 * Remove um formulário da pauta da tarefa (spec 0002, RF-8).
 *
 * Duas recusas deliberadas: o formulário que gerou a tarefa é proveniência e
 * não sai (CB-12); e formulário com respostas só sai com confirmação explícita,
 * porque as respostas voltam a ser avulsas no lead (CB-13).
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";
import { resolveActionAccess } from "@/features/actions/server/lib/can-edit-action";

export const detachFormFromAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      formId: z.string(),
      /** Confirma que as respostas vinculadas voltem a ser avulsas no lead. */
      detachResponses: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const access = await resolveActionAccess(input.actionId, {
      userId: context.user.id,
      org: context.org,
    });

    if (!access) {
      throw errors.NOT_FOUND({ message: "Tarefa não encontrada" });
    }
    if (!access.canEdit) {
      throw errors.FORBIDDEN({ message: "Você não pode editar esta tarefa" });
    }

    const action = await prisma.action.findUnique({
      where: { id: input.actionId },
      select: { formResponse: { select: { formId: true } } },
    });

    if (action?.formResponse?.formId === input.formId) {
      throw errors.BAD_REQUEST({
        message: "Não é possível remover o formulário que gerou esta tarefa.",
      });
    }

    // Pré-checagem só pra devolver a mensagem de confirmação. A contagem que
    // vale é a de dentro da transação: entre as duas, alguém pode preencher o
    // formulário por esta mesma tarefa.
    const previewCount = await prisma.formResponses.count({
      where: { actionId: input.actionId, formId: input.formId },
    });

    // Backstop: a UI já conhece a contagem pelo `action.forms.list` e pede
    // confirmação antes de chamar com `detachResponses: true`.
    if (previewCount > 0 && !input.detachResponses) {
      throw errors.BAD_REQUEST({
        message:
          previewCount === 1
            ? "1 resposta voltará a ser avulsa no lead. Confirme para continuar."
            : `${previewCount} respostas voltarão a ser avulsas no lead. Confirme para continuar.`,
      });
    }

    const detachedResponses = await prisma.$transaction(async (tx) => {
      // Sempre desvincula, mesmo quando a pré-checagem viu zero: uma resposta
      // criada na janela entre as duas ficaria com `actionId` apontando pra
      // tarefa sem linha na pauta, violando a invariante I5.
      const detached = await tx.formResponses.updateMany({
        where: { actionId: input.actionId, formId: input.formId },
        data: { actionId: null },
      });

      await tx.actionForm.deleteMany({
        where: { actionId: input.actionId, formId: input.formId },
      });

      return detached.count;
    });

    return { detachedResponses };
  });
