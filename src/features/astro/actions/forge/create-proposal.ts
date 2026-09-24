import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";

// Criar proposta comercial no Forge (spec 0023, RF-6). A implementação vivia
// dentro de `nasa-command/execute.ts` e devolvia link interno; aqui ela é a
// fonte única e devolve o link público, que é o que se manda ao cliente.

const MAX_NAME_CANDIDATES = 5;

const inputSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2)
    .describe("Nome do cliente. Pode ser parcial — a busca é por aproximação."),
  productName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Produto da proposta, quando o usuário citar um."),
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("Título da proposta. Sem isso, vira 'Proposta - <cliente>'."),
  validUntil: z
    .string()
    .datetime()
    .optional()
    .describe("Validade da proposta em ISO 8601."),
  notes: z.string().trim().max(2000).optional(),
});

function buildPublicUrl(publicToken: string): string {
  // A rota pública é `/(public)/proposta/[token]`. Absoluta quando há
  // NEXT_PUBLIC_APP_URL, porque este link existe para sair da plataforma.
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/proposta/${publicToken}`;
}

async function findClientCandidates(clientName: string, organizationId: string) {
  return prisma.lead.findMany({
    where: {
      name: { contains: clientName.replace(/_/g, " "), mode: "insensitive" },
      tracking: { organizationId },
    },
    select: { id: true, name: true },
    take: MAX_NAME_CANDIDATES,
  });
}

export const createProposalAction: AstroAction<typeof inputSchema> = {
  key: "forge.create_proposal",
  toolName: "create_proposal",
  description:
    "Cria uma proposta comercial no Forge para um cliente e devolve o link público para enviar a ele. " +
    "Use quando o usuário pedir 'cria uma proposta para X', 'monta um orçamento para X'.",
  requiresConfirmation: true,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const organizationId = ctx.organizationId;

    const candidates = await findClientCandidates(input.clientName, organizationId);

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Cliente não encontrado",
        description: `Não achei nenhum cliente com "${input.clientName}". Quer cadastrar esse contato primeiro?`,
        missingFields: [{ key: "clientName", label: "nome do cliente" }],
        appName: "Forge",
      };
    }

    // Homônimo não vira escolha nossa: quem decide é quem conhece o cliente.
    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de um cliente com esse nome",
        description: `Achei ${candidates.length} clientes parecidos com "${input.clientName}". Qual deles?`,
        field: "clientName",
        options: candidates.map((candidate) => ({
          id: candidate.id,
          label: candidate.name,
        })),
        appName: "Forge",
      };
    }

    const client = candidates[0];

    const product = input.productName
      ? await prisma.forgeProduct.findFirst({
          where: {
            organizationId,
            name: { contains: input.productName.replace(/_/g, " "), mode: "insensitive" },
          },
          select: { id: true, name: true },
        })
      : null;

    if (dryRun) {
      return {
        status: "done",
        title: "Criar proposta",
        description:
          `Proposta para ${client.name}` +
          (product ? `, com o produto ${product.name}.` : "."),
        appName: "Forge",
      };
    }

    const lastProposal = await prisma.forgeProposal.findFirst({
      where: { organizationId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const title = input.title ?? `Proposta - ${client.name}`;
    const descriptionParts = [
      product ? `Produto: ${product.name}` : null,
      input.notes ?? null,
    ].filter(Boolean);

    const proposal = await prisma.forgeProposal.create({
      data: {
        organizationId,
        title,
        number: (lastProposal?.number ?? 0) + 1,
        clientId: client.id,
        responsibleId: ctx.userId,
        participants: [],
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        status: "RASCUNHO",
        description: descriptionParts.join("\n\n"),
        headerConfig: {},
        createdById: ctx.userId,
      },
      select: { id: true, number: true, publicToken: true },
    });

    return {
      status: "done",
      title: "Proposta criada",
      description:
        `Proposta #${proposal.number} "${title}" criada para ${client.name}` +
        (product ? `, com o produto ${product.name}.` : "."),
      publicUrl: buildPublicUrl(proposal.publicToken),
      internalUrl: `/forge?tab=proposals&id=${proposal.id}`,
      appName: "Forge",
    };
  },
};
