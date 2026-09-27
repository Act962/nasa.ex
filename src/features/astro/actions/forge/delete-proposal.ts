import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { rememberProposal, resolveProposalReference } from "./proposal-context";
import { notifyForgeProposalsChanged } from "./proposal-events";
import {
  FORGE_APP_NAME,
  PROPOSAL_PICKER,
  inferProposalRef,
  STATUS_LABELS,
  buildInternalUrl,
  formatMoney,
  proposalTotal,
} from "./proposal-shared";

// Excluir proposta (spec 0032, RF-8 e D-3). Só rascunho sem contrato: proposta
// enviada já tem link público na mão do cliente, e a paga tem rastro
// financeiro. Nas outras situações o caminho é cancelar.

const inputSchema = z.object({
  proposalRef: z
    .string()
    .trim()
    .describe('Qual proposta: número ("#14"), cliente ("a do Kauê") ou referência ao turno anterior.'),
});

export const deleteProposalAction: AstroAction<typeof inputSchema> = {
  key: "forge.delete_proposal",
  app: "forge",
  toolName: "delete_proposal",
  description:
    "Exclui de vez uma proposta em rascunho do Forge. Use em 'exclui a proposta #10', " +
    "'apaga o rascunho do Kauê'. Proposta enviada ou paga não é excluída — nessas, use cancel_proposal.",
  permission: { appKey: "forge", action: "delete" },
  requiresConfirmation: true,
  confirmTitle: "Excluir proposta",
  confirmWarnings: ["A exclusão é definitiva: o link enviado ao cliente para de funcionar."],
  input: inputSchema,
  fieldSteps: {
    proposalRef: {
      title: "Qual proposta?",
      question: "Busque a proposta pelo número, título ou cliente.",
      picker: PROPOSAL_PICKER,
    },
  },
  inferFields: inferProposalRef,
  intentPatterns: [
    /\b(exclui|excluir|exclua|apaga|apagar|apague|deleta|deletar|delete)\b.{0,25}\bproposta\b/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const lookup = await resolveProposalReference({
      ctx,
      reference: input.proposalRef,
      field: "proposalRef",
    });
    if (lookup.kind !== "found") return lookup.result;
    const { proposal } = lookup;

    if (proposal.status !== "RASCUNHO") {
      const isAlreadyCancelled = proposal.status === "CANCELADA";
      return {
        status: "error",
        title: "Só rascunho pode ser excluído",
        description:
          `A proposta #${proposal.number} está ${STATUS_LABELS[proposal.status] ?? proposal.status}. ` +
          (isAlreadyCancelled
            ? "Ela já não vale mais; o registro fica no histórico de propósito."
            : "Posso cancelar em vez de excluir — é só pedir."),
        internalUrl: buildInternalUrl(proposal.id),
        openLabel: "Abrir no Forge",
        appName: FORGE_APP_NAME,
      };
    }
    if (proposal._count.contracts > 0) {
      return {
        status: "error",
        title: "Proposta com contrato",
        description:
          `A proposta #${proposal.number} tem contrato vinculado e não pode ser excluída. ` +
          "Posso cancelar em vez disso.",
        internalUrl: buildInternalUrl(proposal.id),
        openLabel: "Abrir no Forge",
        appName: FORGE_APP_NAME,
      };
    }

    const summary =
      `Proposta #${proposal.number} "${proposal.title}"` +
      (proposal.client ? ` de ${proposal.client.name}` : "") +
      `, ${formatMoney(proposalTotal(proposal))}`;

    if (dryRun) {
      rememberProposal(ctx, proposal.number);
      return {
        status: "done",
        title: "Excluir proposta",
        description: `${summary}. Isso apaga a proposta de vez.`,
        appName: FORGE_APP_NAME,
      };
    }

    await prisma.forgeProposal.delete({ where: { id: proposal.id } });
    await notifyForgeProposalsChanged(ctx.organizationId);

    return {
      status: "done",
      title: "Proposta excluída",
      description: `${summary} — excluída.`,
      appName: FORGE_APP_NAME,
    };
  },
};
