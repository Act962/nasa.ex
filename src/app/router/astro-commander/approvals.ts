import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getProposalExecutor } from "@/features/astro/server/tools/_shared/proposals/types";
import "@/features/astro-commander/server/approval-executor";

/**
 * Aprovar ou rejeitar uma proposta pela tela (spec 0028, RF-11).
 *
 * O caminho do chat aprova por tool; aqui é por botão, e o executor é o mesmo
 * registrado por `actionType` — a decisão de como executar nunca se divide.
 */

export const approveAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ context, input }) => {
    const pending = await prisma.astroPendingAction.findFirst({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!pending) throw new ORPCError("BAD_REQUEST", { message: "Proposta não encontrada" });
    if (pending.status !== "PENDING") {
      throw new ORPCError("BAD_REQUEST", { message: `Esta proposta está ${pending.status.toLowerCase()}.` });
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      await prisma.astroPendingAction.update({
        where: { id: pending.id },
        data: { status: "EXPIRED" },
      });
      throw new ORPCError("BAD_REQUEST", { message: "Esta proposta expirou." });
    }

    const executor = getProposalExecutor(pending.actionType);
    if (!executor) throw new ORPCError("BAD_REQUEST", { message: `Não sei executar "${pending.actionType}".` });

    try {
      const result = await executor({
        // Quem aprova assume a ação: as permissões conferidas são as dele.
        ctx: {
          userId: context.user.id,
          organizationId: context.org.id,
          route: {},
          channel: "CHAT",
        },
        proposalId: pending.id,
        payload: pending.payload as Record<string, unknown>,
      });

      await prisma.astroPendingAction.update({
        where: { id: pending.id },
        data: {
          status: result.ok ? "CONFIRMED" : "FAILED",
          confirmedAt: new Date(),
          result: (result.data ?? { summary: result.summary }) as object,
          errorMessage: result.ok ? null : result.summary,
        },
      });

      return { ok: result.ok, summary: result.summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao executar";
      await prisma.astroPendingAction.update({
        where: { id: pending.id },
        data: { status: "FAILED", confirmedAt: new Date(), errorMessage: message },
      });
      throw new ORPCError("BAD_REQUEST", { message: `Falhou ao executar: ${message}` });
    }
  });

export const rejectAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ context, input }) => {
    const pending = await prisma.astroPendingAction.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, status: true },
    });
    if (!pending) throw new ORPCError("BAD_REQUEST", { message: "Proposta não encontrada" });
    if (pending.status !== "PENDING") {
      return { ok: true, summary: `Proposta já estava ${pending.status.toLowerCase()}.` };
    }

    await prisma.astroPendingAction.update({
      where: { id: pending.id },
      data: { status: "CANCELLED" },
    });
    return { ok: true, summary: "Proposta rejeitada. Nada foi gravado." };
  });
