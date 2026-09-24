import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { assertPaymentToolAccess } from "@/features/astro/server/tools/finance/access";

// Lançar despesa ou receita. Era o verbo que faltava: "adicione R$ 100 de
// despesa em combustível" caía em `tracking.create_status` e pedia o nome de
// uma coluna — o buraco de sempre, agora no financeiro.
//
// Dinheiro sempre passa por confirmação (spec 0019): a escrita só acontece
// depois do "sim", e o ensaio já mostra conta, valor e vencimento.

const inputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe("O que é o lançamento, ex: 'Combustível'."),
  amount: z
    .number()
    .positive()
    .describe("Valor em reais, ex: 100 para R$ 100,00."),
  // String livre, não enum: o classificador responde em português
  // ("despesa") e o enum recusava, derrubando o verbo depois da ação certa —
  // exatamente o que já tinha acontecido com a recorrência do lembrete.
  type: z
    .string()
    .trim()
    .min(3)
    .describe("Despesa (conta a pagar) ou receita (a receber)."),
  accountName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Conta bancária. Sem isso, usa a única da organização."),
  dueDate: z
    .string()
    .trim()
    .optional()
    .describe("Vencimento com as palavras do usuário. Sem isso, hoje."),
});

const DESPESA = /\bdespesa|gasto|paguei|pagar|saiu|conta a pagar|custo|expense|cost|payable\b/;
const RECEITA = /\breceita|recebi|receber|entrou|venda|conta a receber|revenue|income|receivable\b/;

/** Vocabulário conhecido; traduzir não é trabalho de modelo. */
function normalizeEntryType(raw: string): "PAYABLE" | "RECEIVABLE" | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (key === "payable" || DESPESA.test(key)) return "PAYABLE";
  if (key === "receivable" || RECEITA.test(key)) return "RECEIVABLE";
  return null;
}

/** O tipo está no verbo: "despesa" e "recebi" não são ambíguos. */
function inferEntryType(text: string): Record<string, unknown> {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (DESPESA.test(normalized)) return { type: "PAYABLE" };
  if (RECEITA.test(normalized)) return { type: "RECEIVABLE" };
  return {};
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const createPaymentEntryAction: AstroAction<typeof inputSchema> = {
  key: "payment.create_entry",
  app: "payment",
  toolName: "create_payment_entry",
  description:
    "LANÇA uma despesa ou receita no financeiro — 'adicione R$ 100 de despesa em combustível', " +
    "'lança 500 reais a receber do cliente X'. É dinheiro entrando ou saindo, não é coluna de funil.",
  permission: { appKey: "financeiro", action: "create" },
  requiresConfirmation: true,
  confirmTitle: "Lançar no financeiro",
  inferFields: inferEntryType,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const entryType = normalizeEntryType(input.type);
    if (!entryType) {
      return {
        status: "needs_input",
        title: "Despesa ou receita?",
        description: `Não sei o que é "${input.type}". É despesa (a pagar) ou receita (a receber)?`,
        missingFields: [{ key: "type", label: "se é despesa ou receita" }],
        appName: "Financeiro",
      };
    }

    // A mesma matriz do middleware oRPC e da tela — o Astro não é atalho.
    const access = await assertPaymentToolAccess(ctx, "entries", "create");
    if (!access.ok) {
      return {
        status: "error",
        title: "Sem acesso ao financeiro",
        description: access.error,
        appName: "Financeiro",
      };
    }

    const accounts = await prisma.paymentBankAccount.findMany({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        ...(input.accountName
          ? { name: { contains: input.accountName, mode: "insensitive" } }
          : {}),
      },
      select: { id: true, name: true },
      take: 8,
    });

    if (accounts.length === 0) {
      return {
        status: "needs_input",
        title: "Conta não encontrada",
        description: input.accountName
          ? `Não achei conta com "${input.accountName}".`
          : "Você ainda não tem conta bancária cadastrada no financeiro.",
        missingFields: [{ key: "accountName", label: "o nome da conta" }],
        appName: "Financeiro",
      };
    }

    if (accounts.length > 1) {
      return {
        status: "ambiguous",
        title: "Em qual conta?",
        description: `Você tem ${accounts.length} contas. Em qual lanço?`,
        field: "accountName",
        options: accounts.map((account) => ({ id: account.id, label: account.name })),
        appName: "Financeiro",
      };
    }

    const account = accounts[0];
    const amountCents = Math.round(input.amount * 100);
    const { parseWhen } = await import("../parse-when");
    const parsedDue = input.dueDate ? parseWhen(input.dueDate) : null;
    const dueDate = parsedDue ? new Date(parsedDue) : startOfToday();
    const label = entryType === "PAYABLE" ? "Despesa" : "Receita";

    if (dryRun) {
      return {
        status: "done",
        title: `${label} de ${money(amountCents)}`,
        description:
          `"${input.description}" em ${account.name}, já ${entryType === "PAYABLE" ? "paga" : "recebida"}.`,
        appName: "Financeiro",
      };
    }

    // Quem diz "adicione R$ 100 de despesa" já gastou: o lançamento nasce
    // baixado, não pendente. Pendente é o que ainda vai acontecer, e para
    // isso existe o vencimento dito na frase.
    const isFuture = dueDate.getTime() > Date.now();
    const entry = await prisma.paymentEntry.create({
      data: {
        organizationId: ctx.organizationId,
        type: entryType,
        description: input.description,
        amount: amountCents,
        dueDate,
        accountId: account.id,
        createdById: ctx.userId,
        status: isFuture ? "PENDING" : "PAID",
        paidAmount: isFuture ? 0 : amountCents,
        paidAt: isFuture ? null : new Date(),
      },
      select: { id: true },
    });

    return {
      status: "done",
      title: `${label} lançada`,
      description:
        `${money(amountCents)} — "${input.description}" em ${account.name}, ` +
        (isFuture
          ? `vencendo ${dueDate.toLocaleDateString("pt-BR")}.`
          : `já ${entryType === "PAYABLE" ? "paga" : "recebida"}.`),
      internalUrl: `/payment?entry=${entry.id}`,
      openLabel: "Abrir no Financeiro",
      appName: "Financeiro",
    };
  },
};
