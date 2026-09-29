import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { assertPaymentToolAccess } from "@/features/astro/server/tools/finance/access";
import { parseCalendarDate } from "../parse-when";
import { parsePickedAnswer, buildPickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

// Lançar despesa ou receita. Era o verbo que faltava: "adicione R$ 100 de
// despesa em combustível" caía em `tracking.create_status` e pedia o nome de
// uma coluna — o buraco de sempre, agora no financeiro.
//
// Dinheiro sempre passa por confirmação (spec 0019): a escrita só acontece
// depois do "sim", e o ensaio já mostra conta, valor e vencimento.
// Roteiro (spec 0033, RF-9): tipo → descrição → valor → vencimento → já paga?
// → conta → categoria, cada passo com o seu seletor.

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const NO_CATEGORY_ANSWER = "sem categoria";
const MAX_CATEGORY_OPTIONS = 12;

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
    .describe("Vencimento com as palavras do usuário."),
  settlement: z.string().trim().optional().describe("Já paga ou em aberto, escolhido no roteiro."),
  categoryName: z.string().trim().optional().describe("Categoria do lançamento, quando dita."),
});

const DESPESA = /\bdespesa|gasto|gastei|paguei|pagar|saiu|conta a pagar|custo|expense|cost|payable\b/;
const RECEITA = /\breceita|recebi|receber|entrou|venda|conta a receber|revenue|income|receivable\b/;
/** Verbo no passado: o dinheiro já saiu ou entrou. */
const ALREADY_SETTLED = /\b(paguei|pagamos|gastei|gastamos|recebi|recebemos|saiu|entrou)\b/;

function normalizeIntent(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Vocabulário conhecido; traduzir não é trabalho de modelo. */
function normalizeEntryType(raw: string): "PAYABLE" | "RECEIVABLE" | null {
  const key = normalizeIntent(raw.trim());
  if (key === "payable" || DESPESA.test(key)) return "PAYABLE";
  if (key === "receivable" || RECEITA.test(key)) return "RECEIVABLE";
  return null;
}

/** "R$ 150,00", "150 reais", "1.250,50" → número. */
function parseMoney(raw: string): number | null {
  const digits = raw.replace(/[^\d.,]/g, "");
  if (!digits) return null;
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits.replace(/\.(?=\d{3}\b)/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Tipo, valor, descrição e vencimento saem da frase, sem modelo:
 * "lança uma despesa de R$ 150,00 de internet vencendo dia 10".
 */
function inferEntryFields(text: string): Record<string, unknown> {
  const normalized = normalizeIntent(text);
  const inferred: Record<string, unknown> = {};
  if (DESPESA.test(normalized)) inferred.type = "PAYABLE";
  else if (RECEITA.test(normalized)) inferred.type = "RECEIVABLE";

  const amountText =
    text.match(/r\$\s*([\d.,]+)/i)?.[1] ??
    text.match(/\b([\d.,]+)\s*(?:reais|real)\b/i)?.[1] ??
    text.match(/\b(?:de|por)\s+([\d.,]+)\s+(?:de|em|com|no|na)\b/i)?.[1];
  const amount = amountText ? parseMoney(amountText) : null;
  if (amount) inferred.amount = amount;

  const description = text.match(
    /(?:[\d.,]+\s*(?:reais|real)?|r\$\s*[\d.,]+)\s+(?:de|em|com|no|na)\s+(.+?)(?=\s+(?:vencendo|vence|com vencimento|para o dia|no dia|dia \d|hoje|amanha|amanhã|na conta|no banco|no caixa)\b|,|$)/iu,
  )?.[1];
  // Sem valor na frase, a descrição vem logo depois do tipo: "despesa de internet".
  const descriptionWithoutAmount = text.match(
    /\b(?:despesa|receita|gasto|conta)\s+(?:de|com|em|da|do)\s+(?!r\$|\d)(.+?)(?=\s+(?:de|por)\s+(?:r\$\s*)?\d|\s+(?:vencendo|vence|com vencimento|para o dia|no dia|dia \d|hoje|amanha|amanhã)\b|,|$)/iu,
  )?.[1];
  const inferredDescription = description ?? descriptionWithoutAmount;
  if (inferredDescription && inferredDescription.trim().length >= 2) inferred.description = inferredDescription.trim();

  const dueText = text.match(/\b(?:vencendo|vence|vencimento)\s+(?:em\s+|no\s+|dia\s+)?(.+?)(?=,|$)/iu)?.[1];
  if (dueText) inferred.dueDate = /^\d{1,2}$/.test(dueText.trim()) ? `dia ${dueText.trim()}` : dueText;
  if (ALREADY_SETTLED.test(normalized)) {
    inferred.dueDate ??= "hoje";
    inferred.settlement = "pago";
  }
  return inferred;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function brazilDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: BRAZIL_TIME_ZONE });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: BRAZIL_TIME_ZONE, weekday: "long", day: "2-digit", month: "2-digit" });
}

const TYPE_PICKER: AstroPicker = {
  kind: "select",
  options: [
    { label: "Despesa (a pagar)", answer: "despesa" },
    { label: "Receita (a receber)", answer: "receita" },
  ],
};

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
  inferFields: inferEntryFields,
  codeOnlyFields: ["settlement"],
  intentPatterns: [
    /\b(lanca|lancar|lance|registra|registrar|registre|adiciona|adicionar|adicione|cadastra|cadastrar|nova|novo|quero lancar)\b.{0,30}\b(despesa|receita|gasto|conta a pagar|conta a receber|lancamento)\b/,
    /\b(lanca|lancar|lance)\s+(a|uma|o|um)?\s*(conta|boleto|fatura)\b/,
    /\b(paguei|gastei|recebi)\s+(r\$\s*)?\d/,
  ],
  fieldSteps: {
    type: { title: "Despesa ou receita?", question: "O que você quer lançar?", picker: TYPE_PICKER },
    description: {
      title: "Descrição",
      question: "Do que é o lançamento?",
      picker: { kind: "text", placeholder: "Ex.: Internet, Aluguel, Consultoria", maxLength: 200 },
    },
    amount: {
      title: "Valor",
      question: "Qual o valor?",
      picker: { kind: "text", placeholder: "Ex.: 150,00", maxLength: 20 },
    },
  },
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
        picker: TYPE_PICKER,
      };
    }
    const isPayable = entryType === "PAYABLE";

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

    // "15" sozinho é o dia do mês — o classificador às vezes larga o "dia".
    const dueText = input.dueDate && /^\d{1,2}$/.test(input.dueDate.trim()) ? `dia ${input.dueDate.trim()}` : input.dueDate;
    const parsedDue = dueText ? parseCalendarDate(dueText) : null;
    if (!parsedDue) {
      return {
        status: "needs_input",
        title: "Vencimento",
        description: input.dueDate
          ? `Não entendi "${input.dueDate}" como data. Escolha o vencimento.`
          : "Qual o vencimento?",
        missingFields: [{ key: "dueDate", label: "o vencimento" }],
        appName: "Financeiro",
        picker: { kind: "datetime", mode: "date", allowPast: true },
      };
    }
    const dueDate = new Date(parsedDue);
    const isDueByToday = brazilDateKey(dueDate) <= brazilDateKey(new Date());

    // Vencendo hoje ou antes, só o usuário sabe se o dinheiro já saiu.
    let isSettled = false;
    if (isDueByToday) {
      const settlement = input.settlement ? normalizeIntent(input.settlement) : null;
      if (!settlement || !/^(pago|paga|recebido|recebida|sim|ja|em aberto|aberto|nao)/.test(settlement)) {
        return {
          status: "needs_input",
          title: isPayable ? "Já foi paga?" : "Já foi recebida?",
          description: `Vence ${formatDay(dueDate)}. ${isPayable ? "Já foi paga" : "Já foi recebida"}?`,
          missingFields: [{ key: "settlement", label: "se já foi paga" }],
          appName: "Financeiro",
          picker: {
            kind: "select",
            options: [
              { label: isPayable ? "Já foi paga" : "Já recebi", answer: "pago" },
              { label: "Ainda em aberto", answer: "em aberto" },
            ],
          },
        };
      }
      isSettled = /^(pago|paga|recebido|recebida|sim|ja)/.test(settlement);
    }

    const pickedAccount = input.accountName ? parsePickedAnswer(input.accountName) : null;
    const accounts = await prisma.paymentBankAccount.findMany({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        ...(pickedAccount?.id
          ? { id: pickedAccount.id }
          : pickedAccount
            ? { name: { contains: pickedAccount.label, mode: "insensitive" } }
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
          ? `Não achei conta com "${pickedAccount?.label ?? input.accountName}".`
          : "Você ainda não tem conta bancária cadastrada no financeiro.",
        missingFields: [{ key: "accountName", label: "o nome da conta" }],
        appName: "Financeiro",
      };
    }

    if (accounts.length > 1) {
      return {
        status: "ambiguous",
        title: "Em qual conta?",
        description: `Em qual conta eu lanço?`,
        field: "accountName",
        options: accounts.map((account) => ({ id: account.id, label: account.name })),
        appName: "Financeiro",
        picker: {
          kind: "select",
          options: accounts.map((account) => ({ label: account.name, answer: buildPickedAnswer(account.name, account.id) })),
        },
      };
    }
    const account = accounts[0];

    // Categoria organiza o relatório; pergunta com "Sem categoria" de saída.
    const categories = await prisma.paymentCategory.findMany({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        type: isPayable ? { in: ["EXPENSE", "COST"] } : "REVENUE",
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: MAX_CATEGORY_OPTIONS,
    });
    let category: { id: string; name: string } | null = null;
    if (categories.length > 0) {
      const pickedCategory = input.categoryName ? parsePickedAnswer(input.categoryName) : null;
      const isWithoutCategory = pickedCategory && normalizeIntent(pickedCategory.label) === NO_CATEGORY_ANSWER;
      category = pickedCategory && !isWithoutCategory
        ? (categories.find(
            (item) =>
              item.id === pickedCategory.id ||
              normalizeIntent(item.name) === normalizeIntent(pickedCategory.label),
          ) ?? null)
        : null;
      if (!isWithoutCategory && !category) {
        return {
          status: "needs_input",
          title: "Categoria",
          description: "Em qual categoria?",
          missingFields: [{ key: "categoryName", label: "a categoria" }],
          appName: "Financeiro",
          picker: {
            kind: "select",
            options: [
              ...categories.map((item) => ({ label: item.name, answer: buildPickedAnswer(item.name, item.id) })),
              { label: "Sem categoria", answer: NO_CATEGORY_ANSWER },
            ],
          },
        };
      }
    }

    const amountCents = Math.round(input.amount * 100);
    const label = isPayable ? "Despesa" : "Receita";
    const statusText = isSettled
      ? `já ${isPayable ? "paga" : "recebida"}`
      : `vencendo ${formatDay(dueDate)}`;
    const summary =
      `"${input.description}" em ${account.name}${category ? `, categoria ${category.name}` : ""}, ${statusText}.`;

    if (dryRun) {
      return {
        status: "done",
        title: `${label} de ${money(amountCents)}`,
        description: summary,
        appName: "Financeiro",
      };
    }

    const entry = await prisma.paymentEntry.create({
      data: {
        organizationId: ctx.organizationId,
        type: entryType,
        description: input.description,
        amount: amountCents,
        dueDate,
        accountId: account.id,
        categoryId: category?.id ?? null,
        createdById: ctx.userId,
        status: isSettled ? "PAID" : "PENDING",
        paidAmount: isSettled ? amountCents : 0,
        paidAt: isSettled ? new Date() : null,
      },
      select: { id: true },
    });

    return {
      status: "done",
      title: `${label} lançada`,
      description: `${money(amountCents)} — ${summary}`,
      internalUrl: `/payment?entry=${entry.id}`,
      openLabel: "Abrir no Financeiro",
      appName: "Financeiro",
    };
  },
};
