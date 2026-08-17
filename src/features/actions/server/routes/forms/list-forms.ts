/**
 * Pauta de formulários de uma tarefa + as respostas preenchidas NELA.
 *
 * Escopo é a tarefa, nunca o lead: é exatamente essa distinção que a spec 0002
 * existe pra garantir. Respostas avulsas do lead não aparecem aqui.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";
import { deriveResponseState } from "@/features/form/lib/form-response-state";

export const listActionForms = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    // Mesmo escopo de org do `action.get`: 404 em vez de 403 pra não confirmar
    // a existência de tarefa de outra organização.
    const action = await prisma.action.findFirst({
      where: {
        id: input.actionId,
        workspace: { organizationId: context.org.id },
      },
      select: {
        id: true,
        title: true,
        leadId: true,
        lead: { select: { id: true, name: true } },
        formResponse: { select: { id: true, formId: true } },
      },
    });

    if (!action) {
      throw errors.NOT_FOUND({ message: "Tarefa não encontrada" });
    }

    const [pautaLinks, filledResponses] = await Promise.all([
      prisma.actionForm.findMany({
        where: { actionId: action.id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { formId: true, order: true },
      }),
      prisma.formResponses.findMany({
        where: { actionId: action.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          formId: true,
          leadId: true,
          createdAt: true,
          completedAt: true,
          jsonResponse: true,
          label: true,
        },
      }),
    ]);

    // União defensiva (invariante I5 da spec): tarefas geradas antes desta
    // feature não têm linha em `action_forms`, e mesmo assim precisam mostrar
    // o formulário de origem.
    const formIds = new Set<string>(pautaLinks.map((link) => link.formId));
    for (const response of filledResponses) formIds.add(response.formId);
    if (action.formResponse?.formId) formIds.add(action.formResponse.formId);

    // Mesmo shape do retorno normal lá embaixo — os dois ramos precisam
    // devolver o mesmo contrato, senão `originResponseId` só existe às vezes.
    const actionPayload = {
      id: action.id,
      title: action.title,
      leadId: action.leadId,
      lead: action.lead,
      originFormId: action.formResponse?.formId ?? null,
      originResponseId: action.formResponse?.id ?? null,
    };

    if (formIds.size === 0) {
      return { action: actionPayload, forms: [] };
    }

    const forms = await prisma.form.findMany({
      where: { id: { in: [...formIds] }, organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        jsonBlock: true,
        published: true,
        settings: true,
      },
    });

    const orderByFormId = new Map(
      pautaLinks.map((link) => [link.formId, link.order]),
    );
    const originFormId = actionPayload.originFormId;

    const cards = forms
      .map((form) => {
        const responses = filledResponses
          .filter((response) => response.formId === form.id)
          .map((response) => ({
            id: response.id,
            createdAt: response.createdAt,
            completedAt: response.completedAt,
            label: response.label,
            // Lead divergente é dado legado: sinalizamos em vez de esconder
            // (spec 0002, CB-7).
            hasDivergentLead:
              !!response.leadId &&
              !!action.leadId &&
              response.leadId !== action.leadId,
            state: deriveResponseState({
              jsonResponse: response.jsonResponse,
              jsonBlock: form.jsonBlock,
              createdAt: response.createdAt,
            }),
          }));

        return {
          form: {
            id: form.id,
            name: form.name,
            jsonBlock: form.jsonBlock,
            published: form.published,
            settings: form.settings,
          },
          order: orderByFormId.get(form.id) ?? Number.MAX_SAFE_INTEGER,
          isOrigin: form.id === originFormId,
          isPinned: orderByFormId.has(form.id),
          responses,
        };
      })
      .sort((first, second) => first.order - second.order);

    return { action: actionPayload, forms: cards };
  });
