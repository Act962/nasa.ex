import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { groupLinesForBilling, lastDayOfPeriod, parseSharedCostGroups } from "@/features/form-records/lib/compute-closing";
import { findClosing, loadClosingComputation } from "@/features/form-records/server/closing-data";
import { createPaymentEntryRecord } from "@/features/payment/server/entries/create-entry";

// Fechamento por cliente (spec 0075, RF-10). Fechar é só escrita de banco numa
// transação; as contas a receber são criadas depois, uma a uma (regra 18).

const periodKeySchema = z.string().regex(/^\d{4}-\d{2}$/);
const periodInput = z.object({ formId: z.string(), periodKey: periodKeySchema });

const sharedCostGroupSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().trim().min(1).max(60),
  lines: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        description: z.string().trim().max(120),
        quantity: z.number().min(0).max(1_000_000),
        unit: z.string().max(20),
        totalCents: z.number().int().min(0).max(100_000_000_00),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      }),
    )
    .max(300),
});

const shareSchema = z.object({ groupId: z.string(), name: z.string(), cents: z.number() });

// Marca provisória gravada na linha enquanto a conta é criada. Se o processo
// cair nesse intervalo ela fica para trás; reabrir e fechar o período limpa.
const RESERVATION_PREFIX = "pending:";
// Uma conta pode cobrir várias linhas (o titular e seus vinculados), mas a
// coluna é única: a primeira linha guarda o id da conta e as demais, esta
// marca — "shared:<id da conta>:<id da linha>".
const SHARED_ENTRY_PREFIX = "shared:";

function toRealEntryId(paymentEntryId: string | null): string | null {
  if (!paymentEntryId || paymentEntryId.startsWith(RESERVATION_PREFIX)) return null;
  if (paymentEntryId.startsWith(SHARED_ENTRY_PREFIX)) return paymentEntryId.split(":")[1] || null;
  return paymentEntryId;
}

function readShares(rawShares: unknown): z.infer<typeof shareSchema>[] {
  const parsed = z.array(shareSchema).safeParse(rawShares);
  return parsed.success ? parsed.data : [];
}

async function assertFormInOrganization(formId: string, organizationId: string) {
  return prisma.form.findFirst({ where: { id: formId, organizationId }, select: { id: true, name: true } });
}

export const getFormClosing = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get the closing of a form period", tags: ["Forms"] })
  .input(periodInput)
  .output(
    z.object({
      formName: z.string(),
      closingId: z.string().nullable(),
      status: z.enum(["OPEN", "CLOSED"]),
      groups: z.array(sharedCostGroupSchema),
      lines: z.array(
        z.object({
          leadId: z.string(),
          leadName: z.string(),
          leadMemberId: z.string(),
          leadMemberName: z.string().nullable(),
          billingMode: z.enum(["TITULAR", "PROPRIO"]),
          costCenterId: z.string().nullable(),
          recordCount: z.number(),
          usageCents: z.number(),
          shares: z.array(shareSchema),
          sharedCostCents: z.number(),
          totalCents: z.number(),
          paymentEntryId: z.string().nullable(),
        }),
      ),
      totalRecords: z.number(),
      usageCents: z.number(),
      sharedCostCents: z.number(),
      totalCents: z.number(),
      draftCount: z.number(),
      withoutClientCount: z.number(),
      periodKeys: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const form = await assertFormInOrganization(input.formId, organizationId);
    if (!form) throw errors.NOT_FOUND({ message: "Formulário não encontrado" });

    const [closing, periodGroups] = await Promise.all([
      findClosing({ organizationId, ...input }),
      prisma.formRecord.groupBy({
        by: ["periodKey"],
        where: { organizationId, formId: input.formId },
        orderBy: { periodKey: "desc" },
      }),
    ]);
    const groups = closing?.groups ?? [];
    const computation = await loadClosingComputation({ organizationId, ...input, groups });
    const periodKeys = periodGroups.map((group) => group.periodKey);

    if (closing?.status === "CLOSED") {
      return {
        formName: form.name,
        closingId: closing.id,
        status: "CLOSED" as const,
        groups,
        lines: closing.lines.map((line) => ({
          leadId: line.leadId,
          leadName: line.leadName,
          leadMemberId: line.leadMemberId,
          leadMemberName: line.leadMemberName,
          billingMode: line.billingMode,
          costCenterId: line.costCenterId,
          recordCount: line.recordCount,
          usageCents: line.usageCents,
          shares: readShares(line.sharedCostShares),
          sharedCostCents: line.sharedCostCents,
          totalCents: line.totalCents,
          paymentEntryId: toRealEntryId(line.paymentEntryId),
        })),
        totalRecords: closing.totalRecords,
        usageCents: closing.usageCents,
        sharedCostCents: closing.sharedCostCents,
        totalCents: closing.usageCents + closing.sharedCostCents,
        // Fichas que chegaram depois do fechamento continuam sendo avisadas.
        draftCount: computation.draftCount,
        withoutClientCount: computation.withoutClientCount,
        periodKeys,
      };
    }

    return {
      formName: form.name,
      closingId: closing?.id ?? null,
      status: "OPEN" as const,
      groups,
      lines: computation.lines.map((line) => ({ ...line, paymentEntryId: null })),
      totalRecords: computation.totalRecords,
      usageCents: computation.usageCents,
      sharedCostCents: computation.sharedCostCents,
      totalCents: computation.totalCents,
      draftCount: computation.draftCount,
      withoutClientCount: computation.withoutClientCount,
      periodKeys,
    };
  });

export const saveClosingSharedCosts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Save the shared costs of an open closing", tags: ["Forms"] })
  .input(periodInput.extend({ groups: z.array(sharedCostGroupSchema).max(10) }))
  .output(z.object({ closingId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const form = await assertFormInOrganization(input.formId, organizationId);
    if (!form) throw errors.NOT_FOUND({ message: "Formulário não encontrado" });

    const existing = await findClosing({ organizationId, formId: input.formId, periodKey: input.periodKey });
    if (existing?.status === "CLOSED") {
      throw errors.BAD_REQUEST({ message: "Este período já foi fechado. Reabra para alterar os custos." });
    }
    const groups = parseSharedCostGroups(input.groups);
    const closing = await prisma.formClosing.upsert({
      where: {
        organizationId_formId_periodKey: { organizationId, formId: input.formId, periodKey: input.periodKey },
      },
      create: { organizationId, formId: input.formId, periodKey: input.periodKey, sharedCostGroups: groups as unknown as object },
      update: { sharedCostGroups: groups as unknown as object },
      select: { id: true },
    });
    return { closingId: closing.id };
  });

export const closeFormPeriod = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Close a form period", tags: ["Forms"] })
  .input(periodInput)
  .output(z.object({ closingId: z.string(), lineCount: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const form = await assertFormInOrganization(input.formId, organizationId);
    if (!form) throw errors.NOT_FOUND({ message: "Formulário não encontrado" });

    const existing = await findClosing({ organizationId, formId: input.formId, periodKey: input.periodKey });
    if (existing?.status === "CLOSED") throw errors.BAD_REQUEST({ message: "Este período já está fechado." });

    const groups = existing?.groups ?? [];
    const computation = await loadClosingComputation({ organizationId, ...input, groups });
    if (computation.withoutClientCount > 0) {
      throw errors.BAD_REQUEST({
        message: `Há ${computation.withoutClientCount} ficha(s) sem cliente neste período. Vincule um cliente ou exclua antes de fechar.`,
      });
    }
    if (computation.lines.length === 0) {
      throw errors.BAD_REQUEST({ message: "Não há ficha enviada neste período para fechar." });
    }

    const scope = { organizationId, formId: input.formId, periodKey: input.periodKey };
    const closingId = await prisma.$transaction(async (tx) => {
      const totals = {
        status: "CLOSED" as const,
        totalRecords: computation.totalRecords,
        usageCents: computation.usageCents,
        sharedCostCents: computation.sharedCostCents,
        closedAt: new Date(),
        closedById: context.user.id,
      };
      const closing = await tx.formClosing.upsert({
        where: { organizationId_formId_periodKey: scope },
        create: { ...scope, sharedCostGroups: groups as unknown as object, ...totals },
        update: totals,
        select: { id: true },
      });
      await tx.formClosingLine.deleteMany({ where: { closingId: closing.id } });
      await tx.formClosingLine.createMany({
        data: computation.lines.map((line) => ({
          closingId: closing.id,
          leadId: line.leadId,
          leadName: line.leadName,
          leadMemberId: line.leadMemberId,
          leadMemberName: line.leadMemberName,
          billingMode: line.billingMode,
          costCenterId: line.costCenterId,
          recordCount: line.recordCount,
          usageCents: line.usageCents,
          sharedCostShares: line.shares as unknown as object,
          sharedCostCents: line.sharedCostCents,
          totalCents: line.totalCents,
        })),
      });
      // Só as fichas que entraram na conta ficam travadas.
      await tx.formRecord.updateMany({
        where: { ...scope, finalizedAt: { not: null }, leadId: { not: null } },
        data: { closingId: closing.id },
      });
      return closing.id;
    });

    return { closingId, lineCount: computation.lines.length };
  });

export const reopenFormPeriod = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Reopen a closed form period", tags: ["Forms"] })
  .input(periodInput)
  .output(z.object({ closingId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const closing = await findClosing({ organizationId, formId: input.formId, periodKey: input.periodKey });
    if (!closing || closing.status !== "CLOSED") throw errors.BAD_REQUEST({ message: "Este período não está fechado." });
    if (closing.lines.some((line) => toRealEntryId(line.paymentEntryId) !== null)) {
      throw errors.BAD_REQUEST({
        message: "Já existem contas a receber geradas para este período. Cancele-as no Financeiro antes de reabrir.",
      });
    }

    await prisma.$transaction([
      prisma.formRecord.updateMany({ where: { closingId: closing.id }, data: { closingId: null } }),
      prisma.formClosingLine.deleteMany({ where: { closingId: closing.id } }),
      prisma.formClosing.update({
        where: { id: closing.id },
        data: { status: "OPEN", closedAt: null, closedById: null },
      }),
    ]);
    return { closingId: closing.id };
  });

export const generateClosingReceivables = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "create"))
  .route({ method: "POST", summary: "Create one receivable per client of a closed period", tags: ["Forms"] })
  .input(periodInput)
  .output(z.object({ createdCount: z.number(), skippedCount: z.number(), failedCount: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const [form, closing] = await Promise.all([
      assertFormInOrganization(input.formId, organizationId),
      findClosing({ organizationId, formId: input.formId, periodKey: input.periodKey }),
    ]);
    if (!form) throw errors.NOT_FOUND({ message: "Formulário não encontrado" });
    if (!closing || closing.status !== "CLOSED") {
      throw errors.BAD_REQUEST({ message: "Feche o período antes de gerar as contas a receber." });
    }

    const dueDate = lastDayOfPeriod(input.periodKey);
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Uma conta por grupo de cobrança (spec 0076, RF-8). A primeira linha do
    // grupo é a âncora: é ela que se reserva e que guarda o id da conta.
    for (const group of groupLinesForBilling(closing.lines)) {
      const [anchorLine, ...otherLines] = group.lines;
      if (anchorLine.paymentEntryId || group.totalCents <= 0) {
        skippedCount += 1;
        continue;
      }
      try {
        // Reserva antes de criar: dois cliques simultâneos não geram duas
        // contas, porque só um deles consegue marcar a âncora.
        const reservation = `${RESERVATION_PREFIX}${closing.id}:${group.key}`;
        const reserved = await prisma.formClosingLine.updateMany({
          where: { id: anchorLine.id, paymentEntryId: null },
          data: { paymentEntryId: reservation },
        });
        if (reserved.count === 0) {
          skippedCount += 1;
          continue;
        }
        try {
          const billedName = group.ownMemberName ? `${anchorLine.leadName} · ${group.ownMemberName}` : anchorLine.leadName;
          const memberBreakdown = group.lines
            .filter((line) => line.leadMemberName)
            .map((line) => `${line.leadMemberName}: ${(line.totalCents / 100).toFixed(2)}`)
            .join("; ");
          const [entry] = await createPaymentEntryRecord({
            organizationId,
            actor: context.user,
            input: {
              type: "RECEIVABLE",
              description: `${form.name} — ${billedName} (${input.periodKey})`,
              amount: group.totalCents,
              dueDate,
              competenceDate: dueDate,
              leadId: group.leadId,
              ...(group.costCenterId ? { costCenterId: group.costCenterId } : {}),
              documentNumber: `FICHAS-${input.periodKey}`,
              notes:
                `${group.recordCount} ficha(s). Itens: ${(group.usageCents / 100).toFixed(2)}. Custos rateados: ${(group.sharedCostCents / 100).toFixed(2)}.` +
                (memberBreakdown ? ` Por vinculado — ${memberBreakdown}.` : ""),
            },
          });
          await prisma.formClosingLine.update({ where: { id: anchorLine.id }, data: { paymentEntryId: entry.id } });
          for (const otherLine of otherLines) {
            await prisma.formClosingLine.update({
              where: { id: otherLine.id },
              data: { paymentEntryId: `${SHARED_ENTRY_PREFIX}${entry.id}:${otherLine.id}` },
            });
          }
          createdCount += 1;
        } catch (creationError) {
          await prisma.formClosingLine.update({ where: { id: anchorLine.id }, data: { paymentEntryId: null } });
          throw creationError;
        }
      } catch (error) {
        failedCount += 1;
        console.error("[form-records/closings] conta a receber falhou", { closingId: closing.id, billingGroup: group.key, error });
      }
    }

    return { createdCount, skippedCount, failedCount };
  });
