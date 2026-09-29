import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { notifyForgeProposalsChanged } from "./proposal-events";
import { FORGE_APP_NAME, proposalSelect, proposalTotal } from "./proposal-shared";

// Limpar rascunhos vazios (spec 0032, RF-9). Existe porque o próprio ASTRO os
// criou às dezenas antes da 0032: sete propostas zeradas do mesmo cliente,
// cada uma nascida de um pedido de EDITAR que virou criar.

const MAX_BATCH = 50;

const inputSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Limitar a um cliente. Sem isso, vale para a organização inteira."),
});

export const deleteEmptyDraftProposalsAction: AstroAction<typeof inputSchema> = {
  key: "forge.delete_empty_draft_proposals",
  app: "forge",
  toolName: "delete_empty_draft_proposals",
  description:
    "Exclui de uma vez as PROPOSTAS em rascunho que estão sem nenhum item (total R$ 0,00). " +
    "Use em 'apaga os rascunhos zerados', 'limpa as propostas vazias', 'apaga os rascunhos vazios do Kauê'. " +
    "Apaga propostas, nunca o cliente.",
  permission: { appKey: "forge", action: "delete" },
  requiresConfirmation: true,
  confirmTitle: "Excluir rascunhos vazios",
  confirmWarnings: ["A exclusão é definitiva."],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const clients = input.clientName
      ? await prisma.lead.findMany({
          where: {
            name: { contains: input.clientName.replace(/_/g, " "), mode: "insensitive" },
            tracking: { organizationId: ctx.organizationId },
          },
          select: { id: true, name: true },
          take: 5,
        })
      : [];

    if (input.clientName && clients.length === 0) {
      return {
        status: "needs_input",
        title: "Cliente não encontrado",
        description: `Não achei nenhum cliente com "${input.clientName}".`,
        missingFields: [{ key: "clientName", label: "nome do cliente" }],
        appName: FORGE_APP_NAME,
      };
    }

    const drafts = await prisma.forgeProposal.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: "RASCUNHO",
        products: { none: {} },
        contracts: { none: {} },
        ...(clients.length ? { clientId: { in: clients.map((client) => client.id) } } : {}),
      },
      orderBy: { number: "asc" },
      take: MAX_BATCH,
      select: proposalSelect,
    });
    // `products: none` já garante o total zerado; a soma confirma antes de apagar.
    const empties = drafts.filter((proposal) => proposalTotal(proposal) === 0);

    const scope = clients.length ? ` de ${clients[0].name}` : "";
    if (empties.length === 0) {
      return {
        status: "error",
        title: "Nada para excluir",
        description: `Não achei nenhum rascunho sem itens${scope}.`,
        appName: FORGE_APP_NAME,
      };
    }

    const list = empties
      .map((proposal) => `#${proposal.number} "${proposal.title}"`)
      .join(", ");

    if (dryRun) {
      return {
        status: "done",
        title: "Excluir rascunhos vazios",
        description: `${empties.length} rascunho(s) sem itens${scope}: ${list}.`,
        appName: FORGE_APP_NAME,
      };
    }

    await prisma.forgeProposal.deleteMany({
      where: { id: { in: empties.map((proposal) => proposal.id) } },
    });
    await notifyForgeProposalsChanged(ctx.organizationId);

    return {
      status: "done",
      title: "Rascunhos excluídos",
      description: `Excluí ${empties.length} rascunho(s) sem itens${scope}: ${list}.`,
      appName: FORGE_APP_NAME,
    };
  },
};
