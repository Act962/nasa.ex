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

// Cancelar proposta (spec 0032, RF-7). Cancelar preserva o histórico e o link
// que o cliente já recebeu; excluir é outro verbo, só para rascunho.

const inputSchema = z.object({
  proposalRef: z
    .string()
    .trim()
    .describe('Qual proposta: número ("#14"), cliente ("a do Kauê") ou referência ao turno anterior.'),
});

export const cancelProposalAction: AstroAction<typeof inputSchema> = {
  key: "forge.cancel_proposal",
  app: "forge",
  toolName: "cancel_proposal",
  description:
    "Cancela uma proposta do Forge (a situação vira Cancelada, e nada é apagado). " +
    "Use em 'cancela a proposta #14', 'cancela a proposta do Kauê'.",
  permission: { appKey: "forge", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Cancelar proposta",
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
    /\b(cancela|cancelar|cancele)\b.{0,25}\bproposta\b/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const lookup = await resolveProposalReference({
      ctx,
      reference: input.proposalRef,
      field: "proposalRef",
    });
    if (lookup.kind !== "found") return lookup.result;
    const { proposal } = lookup;

    if (proposal.status === "PAGA") {
      return {
        status: "error",
        title: "Proposta paga",
        description: `A proposta #${proposal.number} está paga e não pode ser cancelada.`,
        internalUrl: buildInternalUrl(proposal.id),
        openLabel: "Abrir no Forge",
        appName: FORGE_APP_NAME,
      };
    }
    if (proposal.status === "CANCELADA") {
      return {
        status: "error",
        title: "Já cancelada",
        description: `A proposta #${proposal.number} já estava cancelada.`,
        internalUrl: buildInternalUrl(proposal.id),
        openLabel: "Abrir no Forge",
        appName: FORGE_APP_NAME,
      };
    }

    const summary =
      `Proposta #${proposal.number} "${proposal.title}"` +
      (proposal.client ? ` de ${proposal.client.name}` : "") +
      `, ${STATUS_LABELS[proposal.status] ?? proposal.status}, ${formatMoney(proposalTotal(proposal))}`;

    if (dryRun) {
      rememberProposal(ctx, proposal.number);
      return {
        status: "done",
        title: "Cancelar proposta",
        description: `${summary}. Ela passa a Cancelada; nada é apagado.`,
        appName: FORGE_APP_NAME,
      };
    }

    await prisma.forgeProposal.update({
      where: { id: proposal.id },
      data: { status: "CANCELADA" },
    });
    await notifyForgeProposalsChanged(ctx.organizationId);
    rememberProposal(ctx, proposal.number);

    return {
      status: "done",
      title: "Proposta cancelada",
      description: `${summary} — agora está Cancelada.`,
      internalUrl: buildInternalUrl(proposal.id),
      openLabel: "Abrir no Forge",
      appName: FORGE_APP_NAME,
    };
  },
};
