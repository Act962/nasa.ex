import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { assertPaymentToolAccess } from "@/features/astro/server/tools/finance/access";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

const ENTRY_PICKER: AstroPicker = {
  kind: "entity",
  entity: "payment_entry",
  placeholder: "Buscar lançamento em aberto",
};

/** "marca a conta de internet como paga", "paguei o aluguel" → qual lançamento, sem modelo. */
function inferMarkPaidFields(text: string): Record<string, unknown> {
  const description =
    text.match(/\b(?:marca|marcar|marque)\s+(?:o\s+|a\s+)?(.+?)\s+como\s+(?:pag[oa]|recebid[oa])\b/iu)?.[1] ??
    text.match(/\b(?:marca|marcar|marque)\s+como\s+(?:pag[oa]|recebid[oa])\s+(?:o\s+|a\s+)?(.+?)(?=[,.!?]|$)/iu)?.[1] ??
    text.match(/\b(?:paguei|pagamos|recebi|recebemos)\s+(?:o\s+|a\s+)(.+?)(?=[,.!?]|$)/iu)?.[1] ??
    text.match(/\bbaixa\s+(?:no|na|do|da|em)\s+(.+?)(?=[,.!?]|$)/iu)?.[1];
  return description ? { description: description.trim() } : {};
}

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
  inferFields: inferMarkPaidFields,
  intentPatterns: [
    // "Marca a ficha da Maria como paga" é a baixa da ficha de atendimento (spec 0081), não um lançamento.
    /^(?!.*\bfichas?\b).*\b(marca|marcar|marque)\b.{1,50}\bcomo\s+(pago|paga|recebido|recebida)\b/,
    /\b(dar|da|de|quero dar)\s+baixa\b/,
    /\b(paguei|pagamos|recebi|recebemos)\s+(o|a)\s+(?!r\$|\d)/,
  ],
  fieldSteps: {
    description: { title: "Qual lançamento?", question: "Busque o lançamento em aberto.", picker: ENTRY_PICKER },
  },

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

    const picked = parsePickedAnswer(input.description);
    const candidates = await prisma.paymentEntry.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        ...(picked.id ? { id: picked.id } : { description: { contains: picked.label, mode: "insensitive" } }),
      },
      select: { id: true, description: true, amount: true, dueDate: true, type: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    });

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Lançamento não encontrado",
        description: `Não achei lançamento em aberto com "${picked.label}". Busque abaixo.`,
        missingFields: [{ key: "description", label: "a descrição do lançamento" }],
        appName: "Financeiro",
        picker: ENTRY_PICKER,
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
        picker: ENTRY_PICKER,
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
