import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

// Visão do cliente (spec 0075, RF-11), sem login: o token do link identifica o
// lead e tudo é filtrado pelo id dele, resolvido aqui. Nunca devolve número de
// fichas nem custo total do período — revelariam o volume dos outros clientes.
// Dos vinculados do lead (spec 0076, RF-9 e RF-12) saem só nome e tipo: nunca
// documento, telefone nem data de nascimento.

const PERIOD_KEY = /^\d{4}-\d{2}$/;
const shareSchema = z.object({ groupId: z.string(), name: z.string(), cents: z.number() });

function readListedFields(rawKeyFields: unknown): { label: string; value: string }[] {
  if (!rawKeyFields || typeof rawKeyFields !== "object" || Array.isArray(rawKeyFields)) return [];
  return Object.values(rawKeyFields as Record<string, unknown>).flatMap((rawField) => {
    const field = rawField as { label?: unknown; value?: unknown; showInList?: unknown } | null;
    if (!field || field.showInList !== true || typeof field.label !== "string" || typeof field.value !== "string" || !field.value) {
      return [];
    }
    return [{ label: field.label, value: field.value }];
  });
}

export const listClientRecords = base
  .route({ method: "GET", summary: "Public list of the records of a lead, by its public token", tags: ["Forms"] })
  .input(
    z.object({
      token: z.string().min(10),
      periodKey: z.string().regex(PERIOD_KEY).optional(),
      /** Mostra só as fichas deste vinculado do lead. */
      memberId: z.string().optional(),
    }),
  )
  .output(
    z.object({
      clientFirstName: z.string(),
      clientName: z.string(),
      /** Marca da empresa que atende o cliente, para o cabeçalho da página. */
      organization: z.object({ name: z.string(), logo: z.string().nullable() }),
      /** Vinculados do lead para o organograma; vazio quando ele não tem nenhum. */
      members: z.array(
        z.object({
          id: z.string(),
          parentMemberId: z.string().nullable(),
          name: z.string(),
          kind: z.string().nullable(),
          isPromoted: z.boolean(),
          recordCount: z.number(),
          /** Itens das fichas do período; com o período fechado, o total com os custos rateados. */
          totalCents: z.number(),
        }),
      ),
      selectedMemberId: z.string().nullable(),
      periodKey: z.string().nullable(),
      periodKeys: z.array(z.string()),
      records: z.array(
        z.object({
          responseId: z.string(),
          formName: z.string(),
          label: z.string().nullable(),
          leadMemberName: z.string().nullable(),
          referenceDate: z.string(),
          usageTotalCents: z.number(),
          fields: z.array(z.object({ label: z.string(), value: z.string() })),
        }),
      ),
      usageCents: z.number(),
      /** Uma entrada por formulário com período já fechado. Vazio = prévia. */
      closedSummaries: z.array(
        z.object({
          formName: z.string(),
          leadMemberName: z.string().nullable(),
          recordCount: z.number(),
          usageCents: z.number(),
          shares: z.array(shareSchema),
          totalCents: z.number(),
        }),
      ),
      /** Há ficha do período em formulário cujo fechamento ainda não saiu. */
      hasOpenPeriod: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const lead = await prisma.lead.findUnique({
      where: { publicToken: input.token },
      select: { id: true, name: true, tracking: { select: { organization: { select: { name: true, logo: true } } } } },
    });
    if (!lead) throw errors.NOT_FOUND({ message: "Link inválido" });

    const allMembers = await prisma.leadMember.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, parentMemberId: true, name: true, kind: true, archivedAt: true, promotedLeadId: true },
    });
    // O vinculado pedido tem de ser deste lead: id de outro cliente responde como link inválido.
    const selectedMember = input.memberId ? allMembers.find((member) => member.id === input.memberId) : undefined;
    if (input.memberId && !selectedMember) throw errors.NOT_FOUND({ message: "Link inválido" });
    const memberNameById = new Map(allMembers.map((member) => [member.id, member.name]));

    // Rascunho não aparece para o cliente: ainda pode mudar.
    const leadScope = { leadId: lead.id, finalizedAt: { not: null } };
    // Escolher um vinculado traz também quem está abaixo dele (a regional e as lojas dela).
    const childIdsByParentId = new Map<string, string[]>();
    for (const member of allMembers) {
      if (member.parentMemberId && member.parentMemberId !== member.id) {
        childIdsByParentId.set(member.parentMemberId, [...(childIdsByParentId.get(member.parentMemberId) ?? []), member.id]);
      }
    }
    const collectBranchIds = (memberId: string, visitedIds = new Set<string>()): string[] => {
      if (visitedIds.has(memberId)) return [];
      visitedIds.add(memberId);
      return [memberId, ...(childIdsByParentId.get(memberId) ?? []).flatMap((childId) => collectBranchIds(childId, visitedIds))];
    };
    const selectedBranchIds = selectedMember ? collectBranchIds(selectedMember.id) : null;
    const scope = { ...leadScope, ...(selectedBranchIds ? { leadMemberId: { in: selectedBranchIds } } : {}) };
    const periodGroups = await prisma.formRecord.groupBy({
      by: ["periodKey"],
      where: scope,
      orderBy: { periodKey: "desc" },
    });
    const periodKeys = periodGroups.map((group) => group.periodKey);
    const periodKey = input.periodKey ?? periodKeys[0] ?? null;
    const clientFirstName = lead.name.split(" ")[0] || "Cliente";
    const organization = { name: lead.tracking.organization.name.trim(), logo: lead.tracking.organization.logo };

    const everFilledMemberIds = new Set(
      (await prisma.formRecord.groupBy({ by: ["leadMemberId"], where: { ...leadScope, leadMemberId: { not: null } } })).map((group) => group.leadMemberId),
    );
    // Arquivado sem ficha não aparece; arquivado com ficha continua, para o histórico não sumir.
    const visibleMembers = allMembers.filter((member) => !member.archivedAt || everFilledMemberIds.has(member.id));
    const toChartMembers = (totalsByMemberId: Map<string, { recordCount: number; totalCents: number }>) =>
      visibleMembers.map((member) => ({
        id: member.id,
        parentMemberId: member.parentMemberId,
        name: member.name,
        kind: member.kind,
        isPromoted: member.promotedLeadId !== null,
        recordCount: totalsByMemberId.get(member.id)?.recordCount ?? 0,
        totalCents: totalsByMemberId.get(member.id)?.totalCents ?? 0,
      }));
    const selectedMemberId = selectedMember?.id ?? null;

    if (!periodKey) {
      return {
        clientFirstName,
        clientName: lead.name,
        organization,
        members: toChartMembers(new Map()),
        selectedMemberId,
        periodKey: null,
        periodKeys,
        records: [],
        usageCents: 0,
        closedSummaries: [],
        hasOpenPeriod: false,
      };
    }

    const [records, closingLines, memberPeriodTotals, memberClosedLines] = await Promise.all([
      prisma.formRecord.findMany({
        where: { ...scope, periodKey },
        orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
        select: {
          responseId: true,
          formId: true,
          label: true,
          leadMemberId: true,
          referenceDate: true,
          usageTotalCents: true,
          keyFields: true,
          form: { select: { name: true } },
          closing: { select: { status: true } },
        },
        take: 500,
      }),
      prisma.formClosingLine.findMany({
        where: { leadId: lead.id, closing: { periodKey, status: "CLOSED" }, ...(selectedBranchIds ? { leadMemberId: { in: selectedBranchIds } } : {}) },
        orderBy: [{ leadMemberName: "asc" }],
        select: {
          leadMemberName: true,
          recordCount: true,
          usageCents: true,
          sharedCostShares: true,
          totalCents: true,
          closing: { select: { form: { select: { name: true } } } },
        },
      }),
      // Totais por vinculado para o organograma: sempre do lead inteiro, mesmo com um vinculado escolhido.
      prisma.formRecord.groupBy({
        by: ["leadMemberId"],
        where: { ...leadScope, periodKey, leadMemberId: { not: null } },
        _count: { _all: true },
        _sum: { usageTotalCents: true },
      }),
      prisma.formClosingLine.findMany({
        where: { leadId: lead.id, leadMemberId: { not: "" }, closing: { periodKey, status: "CLOSED" } },
        select: { leadMemberId: true, totalCents: true },
      }),
    ]);

    const totalsByMemberId = new Map<string, { recordCount: number; totalCents: number }>();
    for (const group of memberPeriodTotals) {
      if (group.leadMemberId) totalsByMemberId.set(group.leadMemberId, { recordCount: group._count._all, totalCents: group._sum.usageTotalCents ?? 0 });
    }
    // Com o período fechado, o total do vinculado é o gravado no fechamento (itens + custos rateados).
    const closedCentsByMemberId = new Map<string, number>();
    for (const line of memberClosedLines) closedCentsByMemberId.set(line.leadMemberId, (closedCentsByMemberId.get(line.leadMemberId) ?? 0) + line.totalCents);
    for (const [memberId, closedCents] of closedCentsByMemberId) {
      totalsByMemberId.set(memberId, { recordCount: totalsByMemberId.get(memberId)?.recordCount ?? 0, totalCents: closedCents });
    }

    // O nó mostra o que é dele somado ao de quem está abaixo, igual ao que o link dele abre.
    const branchTotalsByMemberId = new Map(
      allMembers.map((member) => {
        const branchTotals = collectBranchIds(member.id).reduce(
          (total, branchMemberId) => ({
            recordCount: total.recordCount + (totalsByMemberId.get(branchMemberId)?.recordCount ?? 0),
            totalCents: total.totalCents + (totalsByMemberId.get(branchMemberId)?.totalCents ?? 0),
          }),
          { recordCount: 0, totalCents: 0 },
        );
        return [member.id, branchTotals] as const;
      }),
    );

    return {
      clientFirstName,
      clientName: lead.name,
      organization,
      members: toChartMembers(branchTotalsByMemberId),
      selectedMemberId,
      periodKey,
      periodKeys,
      records: records.map((record) => ({
        responseId: record.responseId,
        formName: record.form.name,
        label: record.label,
        leadMemberName: record.leadMemberId ? (memberNameById.get(record.leadMemberId) ?? null) : null,
        referenceDate: record.referenceDate.toISOString(),
        usageTotalCents: record.usageTotalCents,
        fields: readListedFields(record.keyFields),
      })),
      usageCents: records.reduce((total, record) => total + record.usageTotalCents, 0),
      closedSummaries: closingLines.map((line) => {
        const shares = z.array(shareSchema).safeParse(line.sharedCostShares);
        return {
          formName: line.closing.form.name,
          leadMemberName: line.leadMemberName,
          recordCount: line.recordCount,
          usageCents: line.usageCents,
          shares: shares.success ? shares.data : [],
          totalCents: line.totalCents,
        };
      }),
      hasOpenPeriod: records.some((record) => record.usageTotalCents > 0 && record.closing?.status !== "CLOSED"),
    };
  });
