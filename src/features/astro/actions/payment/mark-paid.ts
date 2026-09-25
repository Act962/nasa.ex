import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { assertPaymentToolAccess } from "@/features/astro/server/tools/finance/access";

// Baixar lançamento. "Paguei a conta de luz" é a frase mais dita depois de
// lançar, e não tinha verbo: o lançamento ficava vencido para sempre.

const inputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2)
    .describe("Lançamento a baixar, pelo que está escrito nele."),
});

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export const markPaymentPaidAction: AstroAction<typeof inputSchema> = {
  key: "payment.mark_paid",
  app: "payment",
  toolName: "mark_payment_entry_paid",
  description:
    "BAIXA um lançamento do financeiro — 'paguei a conta de luz', 'marca o aluguel como pago', " +
    "'recebi do cliente X'. Muda um lançamento que já existe para pago.",
  permission: { appKey: "financeiro", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Dar baixa no financeiro",
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) {
      return {
        status: "error",
        title: "Sem acesso ao financeiro",
        description: access.error,
        appName: "Financeiro",
      };
    }

    const candidates = await prisma.paymentEntry.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        description: { contains: input.description, mode: "insensitive" },
      },
      select: { id: true, description: true, amount: true, dueDate: true, type: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    });

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Lançamento não encontrado",
        description: `Não achei lançamento em aberto com "${input.description}".`,
        missingFields: [{ key: "description", label: "a descrição do lançamento" }],
        appName: "Financeiro",
      };
    }

    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Qual lançamento?",
        description: `Achei ${candidates.length} em aberto parecidos com "${input.description}".`,
        field: "description",
        options: candidates.map((entry) => ({
          id: entry.id,
          label: `${entry.description} — ${money(entry.amount)} (${entry.dueDate.toLocaleDateString("pt-BR")})`,
        })),
        appName: "Financeiro",
      };
    }

    const entry = candidates[0];
    const verbo = entry.type === "PAYABLE" ? "pago" : "recebido";

    if (dryRun) {
      return {
        status: "done",
        title: "Dar baixa",
        description: `"${entry.description}" de ${money(entry.amount)} será marcado como ${verbo}.`,
        appName: "Financeiro",
      };
    }

    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: { status: "PAID", paidAmount: entry.amount, paidAt: new Date() },
    });

    return {
      status: "done",
      title: "Baixa registrada",
      description: `"${entry.description}" de ${money(entry.amount)} marcado como ${verbo}.`,
      internalUrl: `/payment?entry=${entry.id}`,
      openLabel: "Abrir no Financeiro",
      appName: "Financeiro",
    };
  },
};
