import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { parseCalendarDate } from "../parse-when";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";
import { rememberProposal, resolveProposalReference } from "./proposal-context";
import { notifyForgeProposalsChanged } from "./proposal-events";
import {
  FORGE_APP_NAME,
  PROPOSAL_PICKER,
  STATUS_LABELS,
  buildInternalUrl,
  buildPublicUrl,
  describeProductLine,
  formatDate,
  formatMoney,
  inferProposalRef,
  isEditable,
  normalizeText,
  proposalTotal,
  resolveProducts,
  splitProductRequests,
  type ProposalRow,
} from "./proposal-shared";

// Editar proposta existente (spec 0032, RF-5/RF-6). Antes disto, "adiciona o
// Setup na #14" oferecia CRIAR outra proposta — a origem dos sete rascunhos
// zerados do mesmo cliente.

const inputSchema = z.object({
  proposalRef: z
    .string()
    .trim()
    .describe(
      'Qual proposta: o número ("#14"), o nome do cliente ("a do Kauê") ou a referência ao ' +
        'turno anterior ("nela"). Deixe vazio se o usuário só disse "nela".',
    ),
  addProducts: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe('Produtos a acrescentar, separados por vírgula. Quantidade antes do nome ("2 Setup").'),
  removeProducts: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Produtos a remover da proposta, separados por vírgula."),
  validUntil: z.string().datetime().optional().describe("Nova validade em ISO 8601."),
  title: z.string().trim().max(120).optional().describe("Novo título da proposta."),
  changeKind: z.string().trim().optional().describe("O que mudar, escolhido no roteiro."),
});

type ItemRow = ProposalRow["products"][number];

const CHANGE_KIND_OPTIONS = [
  { label: "Acrescentar produto", answer: "addProducts" },
  { label: "Remover produto", answer: "removeProducts" },
  { label: "Mudar validade", answer: "validUntil" },
  { label: "Mudar título", answer: "title" },
];

const ADD_PRODUCTS_PICKER: AstroPicker = {
  kind: "entity",
  entity: "product",
  multiple: true,
  placeholder: "Buscar produto",
};

const NEW_VALIDITY_PICKER: AstroPicker = {
  kind: "select",
  options: ["7 dias", "15 dias", "30 dias", "60 dias"].map((label) => ({ label, answer: label })),
};

/** "adiciona o Setup na proposta #14", "tira o Treinamento da do Kauê" → campos, sem modelo. */
function inferUpdateProposalFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = { ...inferProposalRef(text) };
  const added = text.match(
    /\b(?:adiciona|adicionar|acrescenta|acrescentar|coloca|colocar|inclui|incluir)\s+(?:o\s+|a\s+|os\s+|as\s+)?(.+?)\s+(?:na|a)\s+proposta\b/iu,
  )?.[1];
  if (added) inferred.addProducts = added.trim();
  const removed = text.match(
    /\b(?:tira|tirar|remove|remover)\s+(?:o\s+|a\s+|os\s+|as\s+)?(.+?)\s+da\s+proposta\b/iu,
  )?.[1];
  if (removed) inferred.removeProducts = removed.trim();
  // O campo de validade é ISO: a conta de "30 dias" é feita aqui, não pelo modelo.
  const validity = text.match(/\bvalidade\b.*?\b(?:para|pra)\s+(\d{1,3}\s*dias?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/iu)?.[1];
  const validityIso = validity ? parseCalendarDate(validity) : null;
  if (validityIso) inferred.validUntil = validityIso;
  return inferred;
}

function matchesRequestedName(item: ItemRow, requestedName: string): boolean {
  const itemTokens = new Set(
    normalizeText(item.product.name)
      .split(/[^a-z0-9%]+/)
      .filter((token) => token.length >= 3),
  );
  const requestedTokens = normalizeText(requestedName)
    .split(/[^a-z0-9%]+/)
    .filter((token) => token.length >= 3);
  return requestedTokens.length > 0 && requestedTokens.every((token) => itemTokens.has(token));
}

export const updateProposalAction: AstroAction<typeof inputSchema> = {
  key: "forge.update_proposal",
  app: "forge",
  toolName: "update_proposal",
  description:
    "Altera uma proposta que já existe no Forge: acrescenta ou remove produtos, muda quantidade, " +
    "validade ou título. Use em 'adiciona o Setup na proposta #14', 'tira o Treinamento da proposta do Kauê', " +
    "'muda a validade da #14 para 30 dias'. NÃO cria proposta nova.",
  permission: { appKey: "forge", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Alterar proposta",
  input: inputSchema,
  fieldSteps: {
    proposalRef: {
      title: "Qual proposta?",
      question: "Busque a proposta pelo número, título ou cliente.",
      picker: PROPOSAL_PICKER,
    },
  },
  inferFields: inferUpdateProposalFields,
  codeOnlyFields: ["changeKind"],
  intentPatterns: [
    /\b(adiciona|adicionar|acrescenta|acrescentar|coloca|colocar|inclui|incluir|muda|mudar|altera|alterar|edita|editar)\b.{0,40}\bproposta\b/,
    /\b(tira|tirar|remove|remover)\b.{1,40}\bda\s+proposta\b/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const hasChange =
      !!input.addProducts || !!input.removeProducts || !!input.validUntil || !!input.title;
    const lookup = await resolveProposalReference({
      ctx,
      reference: input.proposalRef,
      field: "proposalRef",
    });
    if (lookup.kind !== "found") return lookup.result;
    const { proposal } = lookup;

    // Roteiro: sem mudança na frase, pergunta o quê e depois o novo valor.
    if (!hasChange) {
      const changeKind = CHANGE_KIND_OPTIONS.find(
        (option) => option.answer === input.changeKind || option.label === input.changeKind,
      )?.answer;
      if (!changeKind) {
        return {
          status: "needs_input",
          title: "O que mudar?",
          description: `O que mudar na proposta #${proposal.number} "${proposal.title}"?`,
          missingFields: [{ key: "changeKind", label: "o que mudar" }],
          appName: FORGE_APP_NAME,
          picker: { kind: "select", options: CHANGE_KIND_OPTIONS },
        };
      }
      if (changeKind === "removeProducts" && proposal.products.length === 0) {
        return {
          status: "error",
          title: "Proposta sem itens",
          description: `A proposta #${proposal.number} não tem produtos para remover.`,
          internalUrl: buildInternalUrl(proposal.id),
          openLabel: "Abrir no Forge",
          appName: FORGE_APP_NAME,
        };
      }
      const changeStep: Record<string, { title: string; picker: AstroPicker }> = {
        addProducts: { title: "Quais produtos acrescentar?", picker: ADD_PRODUCTS_PICKER },
        removeProducts: {
          title: "Qual produto remover?",
          picker: {
            kind: "select",
            options: proposal.products.map((item) => ({ label: item.product.name, answer: item.product.name })),
          },
        },
        validUntil: { title: "Nova validade", picker: NEW_VALIDITY_PICKER },
        title: { title: "Novo título", picker: { kind: "text", suggestion: proposal.title, maxLength: 120 } },
      };
      const step = changeStep[changeKind];
      return {
        status: "needs_input",
        title: step.title,
        description: `Proposta #${proposal.number} "${proposal.title}".`,
        missingFields: [{ key: changeKind, label: step.title }],
        appName: FORGE_APP_NAME,
        picker: step.picker,
      };
    }

    if (!isEditable(proposal)) {
      return {
        status: "error",
        title: "Proposta não pode ser alterada",
        description:
          `A proposta #${proposal.number} está ${STATUS_LABELS[proposal.status] ?? proposal.status} ` +
          "e não aceita alteração.",
        internalUrl: buildInternalUrl(proposal.id),
        openLabel: "Abrir no Forge",
        appName: FORGE_APP_NAME,
      };
    }

    const totalBefore = proposalTotal(proposal);
    const changes: string[] = [];

    const added = input.addProducts
      ? await resolveProducts(input.addProducts, ctx.organizationId)
      : { found: [], notFound: [], ambiguous: null };
    if (added.ambiguous) {
      return {
        status: "ambiguous",
        title: "Qual produto?",
        description: `Tem mais de um produto parecido com "${added.ambiguous.requested}".`,
        field: "addProducts",
        options: added.ambiguous.options,
        appName: FORGE_APP_NAME,
      };
    }

    const removedItems: ItemRow[] = [];
    const removeNotFound: string[] = [];
    if (input.removeProducts) {
      for (const request of splitProductRequests(input.removeProducts)) {
        const item = proposal.products.find(
          (candidate) =>
            matchesRequestedName(candidate, request.name) &&
            !removedItems.some((chosen) => chosen.id === candidate.id),
        );
        if (item) removedItems.push(item);
        else removeNotFound.push(request.name);
      }
    }

    const totalAfter =
      totalBefore +
      added.found.reduce((sum, product) => sum + Number(product.unitValue) * product.quantity, 0) -
      removedItems.reduce((sum, item) => sum + Number(item.unitValue) * Number(item.quantity), 0);

    if (added.found.length) changes.push(`+ ${added.found.map(describeProductLine).join(", ")}`);
    if (removedItems.length) {
      changes.push(`− ${removedItems.map((item) => item.product.name).join(", ")}`);
    }
    if (input.validUntil) changes.push(`validade → ${formatDate(new Date(input.validUntil))}`);
    if (input.title) changes.push(`título → "${input.title}"`);
    if (added.notFound.length) changes.push(`não achei no Forge: ${added.notFound.join(", ")}`);
    if (removeNotFound.length) {
      changes.push(`não estão nesta proposta: ${removeNotFound.join(", ")}`);
    }

    const nothingToApply =
      added.found.length === 0 && removedItems.length === 0 && !input.validUntil && !input.title;
    if (nothingToApply) {
      return {
        status: "error",
        title: "Nada a alterar",
        description:
          `Na proposta #${proposal.number} não achei o que mudar. ${changes.join("; ")}.`,
        internalUrl: buildInternalUrl(proposal.id),
        openLabel: "Abrir no Forge",
        appName: FORGE_APP_NAME,
      };
    }

    const totalLine =
      totalAfter === totalBefore
        ? `Total segue em ${formatMoney(totalBefore)}.`
        : `Total ${formatMoney(totalBefore)} → ${formatMoney(totalAfter)}.`;
    const emptyWarning =
      totalAfter === 0 && totalBefore > 0 ? " A proposta fica sem itens." : "";

    if (dryRun) {
      rememberProposal(ctx, proposal.number);
      return {
        status: "done",
        title: "Alterar proposta",
        description:
          `Proposta #${proposal.number} "${proposal.title}"` +
          (proposal.client ? ` (${proposal.client.name})` : "") +
          `: ${changes.join("; ")}. ${totalLine}${emptyWarning}`,
        appName: FORGE_APP_NAME,
      };
    }

    const lastOrder = proposal.products.reduce((max, item, index) => Math.max(max, index), -1);

    await prisma.$transaction(async (tx) => {
      if (removedItems.length) {
        await tx.forgeProposalProduct.deleteMany({
          where: { id: { in: removedItems.map((item) => item.id) } },
        });
      }
      if (added.found.length) {
        await tx.forgeProposalProduct.createMany({
          data: added.found.map((product, index) => ({
            proposalId: proposal.id,
            productId: product.id,
            quantity: product.quantity,
            unitValue: product.unitValue,
            order: lastOrder + 1 + index,
          })),
        });
      }
      if (input.validUntil || input.title) {
        await tx.forgeProposal.update({
          where: { id: proposal.id },
          data: {
            ...(input.validUntil ? { validUntil: new Date(input.validUntil) } : {}),
            ...(input.title ? { title: input.title } : {}),
          },
        });
      }
    });

    await notifyForgeProposalsChanged(ctx.organizationId);
    rememberProposal(ctx, proposal.number);

    return {
      status: "done",
      title: "Proposta alterada",
      description:
        `Proposta #${proposal.number} "${input.title ?? proposal.title}" atualizada: ` +
        `${changes.join("; ")}. ${totalLine}${emptyWarning}`,
      publicUrl: buildPublicUrl(proposal.publicToken),
      internalUrl: buildInternalUrl(proposal.id),
      appName: FORGE_APP_NAME,
    };
  },
};
