import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import crypto from "crypto";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Endpoint público pra cliente aceitar uma proposta. Cria automaticamente
 * um `ForgeContract` (status `PENDENTE_ASSINATURA`) com 1 signatário
 * (o cliente) e retorna o token desse signatário pro redirect ao fluxo
 * de assinatura digital existente em `/contrato/[token]`.
 *
 * Sem auth — cliente acessa a proposta pelo `publicToken`.
 *
 * Idempotente: se a proposta já tem contrato associado (aceitação
 * anterior), reusa o existente em vez de criar duplicata.
 */
export const acceptProposalAsContract = base
  .route({
    method: "POST",
    path: "/forge/proposals/:token/accept",
    summary: "Accept a public proposal — creates a ForgeContract for signing",
  })
  .input(
    z.object({
      token: z.string().min(1),
      clientName: z.string().min(1),
      clientEmail: z.email("Email inválido"),
      clientPhone: z.string().optional(),
      clientDocument: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const proposal = await prisma.forgeProposal.findUnique({
      where: { publicToken: input.token },
      include: {
        organization: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        products: {
          select: { quantity: true, unitValue: true, discount: true },
        },
        contracts: {
          select: { id: true, signers: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!proposal) {
      throw new ORPCError("NOT_FOUND", { message: "Proposta não encontrada" });
    }
    if (proposal.status === "CANCELADA" || proposal.status === "EXPIRADA") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Proposta cancelada ou expirada não pode ser aceita",
      });
    }
    if (proposal.validUntil && proposal.validUntil < new Date()) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Proposta expirou em " +
          proposal.validUntil.toLocaleDateString("pt-BR"),
      });
    }

    // Idempotência: se já existe contrato associado, devolve o token
    // do primeiro signatário pra reentrada no fluxo.
    if (proposal.contracts.length > 0) {
      const existing = proposal.contracts[0];
      const signers = (existing.signers ?? []) as Array<{
        token: string;
        name?: string;
      }>;
      const signerToken = signers[0]?.token ?? "";
      return {
        contractId: existing.id,
        signerToken,
        reused: true as const,
      };
    }

    // Calcula valor total da proposta (subtotal - desconto top-level)
    const subtotal = proposal.products.reduce((sum, pp) => {
      const base = Number(pp.unitValue) * Number(pp.quantity);
      const disc = Number(pp.discount ?? 0);
      return sum + base - disc;
    }, 0);
    const topDiscount = proposal.discount
      ? proposal.discountType === "PERCENTUAL"
        ? subtotal * (Number(proposal.discount) / 100)
        : Number(proposal.discount)
      : 0;
    const total = Math.max(0, subtotal - topDiscount);

    // Cria o contrato em uma transação atômica.
    const contract = await prisma.$transaction(async (tx) => {
      const last = await tx.forgeContract.findFirst({
        where: { organizationId: proposal.organizationId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const signerToken = crypto.randomUUID();
      const startDate = new Date();
      // Default: vigência de 12 meses. O cliente/empresa edita se quiser.
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const created = await tx.forgeContract.create({
        data: {
          organizationId: proposal.organizationId,
          proposalId: proposal.id,
          number,
          startDate,
          endDate,
          value: total,
          status: "PENDENTE_ASSINATURA",
          content: proposal.description ?? null,
          signers: [
            {
              name: input.clientName,
              email: input.clientEmail,
              whatsapp: input.clientPhone ?? null,
              token: signerToken,
              signed_at: null,
            },
          ],
          clientData: {
            name: input.clientName,
            email: input.clientEmail,
            phone: input.clientPhone ?? null,
            document: input.clientDocument ?? null,
          },
          // O responsável pela proposta é quem "criou" o contrato no
          // sistema — preserva auditoria.
          createdById: proposal.responsible.id,
        },
        select: { id: true, signers: true },
      });

      // Marca proposta como VISUALIZADA (cliente engajou ativamente)
      if (proposal.status === "ENVIADA" || proposal.status === "RASCUNHO") {
        await tx.forgeProposal.update({
          where: { id: proposal.id },
          data: { status: "VISUALIZADA" },
        });
      }

      return { id: created.id, signers: created.signers };
    });

    // Audit log (best-effort)
    try {
      await logActivity({
        organizationId: proposal.organizationId,
        userId: proposal.responsible.id,
        userName: proposal.responsible.name,
        userEmail: input.clientEmail,
        userImage: null,
        appSlug: "forge",
        subAppSlug: "forge-proposals",
        action: "forge.proposal.accepted",
        actionLabel: `Cliente ${input.clientName} aceitou a proposta "${proposal.title}"`,
        resource: proposal.title,
        resourceId: proposal.id,
        metadata: {
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          contractId: contract.id,
        },
      });
    } catch (e) {
      console.error("[forge/accept-proposal] logActivity failed", e);
    }

    const signers = contract.signers as Array<{ token: string }>;
    return {
      contractId: contract.id,
      signerToken: signers[0]?.token ?? "",
      reused: false as const,
    };
  });
