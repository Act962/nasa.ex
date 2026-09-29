import "server-only";
import prisma from "@/lib/prisma";
import { sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

const CALENDAR_NOON_UTC_HOUR = 12;

function calendarDateInDays(days: number): Date {
  const today = new Date();
  return new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + days, CALENDAR_NOON_UTC_HOUR, 0, 0, 0),
  );
}

export async function seedSamplePayment(context: SampleSeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cashAccount = await tx.paymentBankAccount.create({
      data: {
        organizationId: context.organizationId,
        name: sampleName("Caixa"),
        type: "CASH",
        balance: 0,
        isDefault: true,
        color: "#10B981",
      },
    });

    const salesCategory = await tx.paymentCategory.create({
      data: { organizationId: context.organizationId, name: sampleName("Vendas"), type: "REVENUE", color: "#10B981" },
    });
    const suppliersCategory = await tx.paymentCategory.create({
      data: {
        organizationId: context.organizationId,
        name: sampleName("Fornecedores"),
        type: "EXPENSE",
        color: "#F59E0B",
      },
    });
    await tx.paymentCategory.create({
      data: { organizationId: context.organizationId, name: sampleName("Aluguel"), type: "EXPENSE", color: "#EF4444" },
    });

    await tx.paymentEntry.createMany({
      data: [
        {
          organizationId: context.organizationId,
          type: "RECEIVABLE",
          status: "PENDING",
          description: sampleName("Venda para Mercadinho Bom Preço"),
          amount: 125_000,
          dueDate: calendarDateInDays(7),
          categoryId: salesCategory.id,
          accountId: cashAccount.id,
          notes: "Pagamento via PIX combinado com o cliente.",
          createdById: context.ownerUserId,
        },
        {
          organizationId: context.organizationId,
          type: "RECEIVABLE",
          status: "PENDING",
          description: sampleName("Venda para Padaria Pão Quente"),
          amount: 68_990,
          dueDate: calendarDateInDays(14),
          categoryId: salesCategory.id,
          accountId: cashAccount.id,
          notes: "Boleto com vencimento em 14 dias.",
          createdById: context.ownerUserId,
        },
        {
          organizationId: context.organizationId,
          type: "PAYABLE",
          status: "PENDING",
          description: sampleName("Compra de embalagens do fornecedor"),
          amount: 42_050,
          dueDate: calendarDateInDays(10),
          categoryId: suppliersCategory.id,
          accountId: cashAccount.id,
          documentNumber: "NF 1234",
          createdById: context.ownerUserId,
        },
      ],
    });
  });
}
