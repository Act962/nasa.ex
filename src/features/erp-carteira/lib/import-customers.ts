// Spec 0106 (fase 1): grava uma página da carteira do ERP como leads, tags, perfil e Jornada.
// Escreve direto no banco, sem `add-tags` nem `applyTagsByAi`: importar a carteira não pode
// disparar fluxo nenhum (CA-3), senão milhares de clientes receberiam mensagem de uma vez.
import "server-only";
import { Decimal } from "@prisma/client/runtime/client";
import { Prisma } from "@/generated/prisma/client";
import { LeadAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import type { ErpCustomer } from "@/http/nerp/erp-carteira";
import {
  ERP_CUSTOMER_SINCE_EVENT,
  ERP_PURCHASE_EVENT,
  ERP_TAG_GROUP_NAME,
  buildCustomerTags,
  type ErpTagSpec,
} from "./customer-tags";

export type ImportPageReport = {
  read: number;
  created: number;
  updated: number;
  skippedNoContact: number;
  failed: number;
  purchasesAdded: number;
};

export const EMPTY_IMPORT_REPORT: ImportPageReport = {
  read: 0,
  created: 0,
  updated: 0,
  skippedNoContact: 0,
  failed: 0,
  purchasesAdded: 0,
};

export function sumImportReports(left: ImportPageReport, right: ImportPageReport): ImportPageReport {
  return {
    read: left.read + right.read,
    created: left.created + right.created,
    updated: left.updated + right.updated,
    skippedNoContact: left.skippedNoContact + right.skippedNoContact,
    failed: left.failed + right.failed,
    purchasesAdded: left.purchasesAdded + right.purchasesAdded,
  };
}

/** Telefone do ERP no formato do WhatsApp (55 + DDD + número); `null` se não parece telefone brasileiro. */
export function toWhatsappPhone(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

function pickPhone(customer: ErpCustomer): string | null {
  for (const rawPhone of customer.telefones) {
    const phone = toWhatsappPhone(rawPhone);
    if (phone) return phone;
  }
  return null;
}

type TagCache = { groupId: string; idBySlug: Map<string, string> };

async function loadTagCache(organizationId: string): Promise<TagCache> {
  const group = await prisma.tagGroup.upsert({
    where: { name_organizationId: { name: ERP_TAG_GROUP_NAME, organizationId } },
    create: { name: ERP_TAG_GROUP_NAME, organizationId, color: "#0ea5e9" },
    update: {},
    select: { id: true },
  });
  const tags = await prisma.tag.findMany({
    where: { organizationId, trackingId: null, archivedAt: null },
    select: { id: true, slug: true },
  });
  return { groupId: group.id, idBySlug: new Map(tags.map((tag) => [tag.slug, tag.id])) };
}

async function ensureTagIds(
  organizationId: string,
  cache: TagCache,
  specs: ErpTagSpec[],
): Promise<string[]> {
  const tagIds: string[] = [];
  for (const spec of specs) {
    const slug = slugify(spec.name);
    let tagId = cache.idBySlug.get(slug);
    if (!tagId) {
      const created = await prisma.tag.create({
        data: {
          organizationId,
          name: spec.name,
          slug,
          color: spec.color,
          description: spec.description,
          tagGroupId: cache.groupId,
        },
        select: { id: true },
      });
      tagId = created.id;
      cache.idBySlug.set(slug, tagId);
    }
    tagIds.push(tagId);
  }
  return tagIds;
}

/** Tags do grupo "Carteira ERP" são da importação: entram e saem conforme o ERP. As demais nunca são tocadas. */
async function syncManagedTags(leadId: string, groupId: string, tagIds: string[]) {
  await prisma.leadTag.deleteMany({
    where: { leadId, tag: { tagGroupId: groupId }, tagId: { notIn: tagIds } },
  });
  if (tagIds.length > 0) {
    await prisma.leadTag.createMany({
      data: tagIds.map((tagId) => ({ leadId, tagId })),
      skipDuplicates: true,
    });
  }
}

async function findExistingLead(organizationId: string, customer: ErpCustomer, phone: string | null) {
  const byCode = await prisma.leadErpProfile.findFirst({
    where: { organizationId, customerCodes: { has: customer.codigo } },
    select: { leadId: true },
  });
  if (byCode) return byCode.leadId;
  if (phone) {
    const byPhone = await prisma.lead.findFirst({
      where: { tracking: { organizationId }, phone: { in: waIdLookupVariants(phone) } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (byPhone) return byPhone.id;
  }
  if (customer.documento) {
    const byDocument = await prisma.lead.findFirst({
      where: { tracking: { organizationId }, document: customer.documento },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (byDocument) return byDocument.id;
  }
  return null;
}

async function nextOrderInStatus(statusId: string): Promise<Decimal> {
  const last = await prisma.lead.findFirst({
    where: { statusId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return new Decimal(last?.order ?? 0).plus(1);
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

async function upsertProfile(
  organizationId: string,
  leadId: string,
  customer: ErpCustomer,
  syncedAt: Date,
) {
  const current = await prisma.leadErpProfile.findUnique({
    where: { leadId },
    select: { customerCodes: true },
  });
  const profileData = {
    branchCode: customer.filial?.codigo ?? null,
    branchName: customer.filial?.nome ?? null,
    consultantCode: customer.consultor?.codigo ?? null,
    consultantName: customer.consultor?.nome ?? null,
    customerSince: toDate(customer.clienteDesde),
    firstPurchaseAt: toDate(customer.primeiraCompra),
    lastPurchaseAt: toDate(customer.ultimaCompra),
    lastPurchaseAmount: customer.valorUltimaCompra,
    totalPurchased: customer.totalComprado,
    ordersCount: customer.quantidadeDePedidos,
    overdueAmount: customer.divida?.valor ?? 0,
    overdueInstallments: customer.divida?.parcelas ?? 0,
    oldestOverdueAt: toDate(customer.divida?.vencimentoMaisAntigo ?? null),
    interests: customer.interesses,
    lastProducts: customer.ultimosProdutos,
    syncedAt,
  };
  await prisma.leadErpProfile.upsert({
    where: { leadId },
    create: { leadId, organizationId, customerCodes: [customer.codigo], ...profileData },
    update: {
      customerCodes: [...new Set([...(current?.customerCodes ?? []), customer.codigo])],
      ...profileData,
    },
  });
}

/** Compras novas viram eventos da Jornada na data real; a chave é o número do pedido no ERP. */
async function addPurchaseEvents(leadId: string, customer: ErpCustomer): Promise<number> {
  const existing = await prisma.leadJourneyEvent.findMany({
    where: { leadId, kind: { in: [ERP_PURCHASE_EVENT, ERP_CUSTOMER_SINCE_EVENT] } },
    select: { kind: true, metadata: true },
  });
  const knownOrders = new Set(
    existing.flatMap((event) => {
      const metadata = event.metadata as { orderNumber?: unknown } | null;
      return event.kind === ERP_PURCHASE_EVENT && typeof metadata?.orderNumber === "string"
        ? [metadata.orderNumber]
        : [];
    }),
  );
  const hasCustomerSince = existing.some((event) => event.kind === ERP_CUSTOMER_SINCE_EVENT);

  const branchNameByCode = new Map(
    customer.filial ? [[customer.filial.codigo, customer.filial.nome]] : [],
  );
  const newEvents: Prisma.LeadJourneyEventCreateManyInput[] = customer.pedidos
    .filter((order) => !knownOrders.has(order.numero))
    .map((order) => ({
      leadId,
      kind: ERP_PURCHASE_EVENT,
      occurredAt: new Date(order.data),
      metadata: {
        source: "erp",
        orderNumber: order.numero,
        amount: order.valor,
        branchCode: order.filial,
        branchName: order.filial ? (branchNameByCode.get(order.filial) ?? null) : null,
      },
    }));
  if (!hasCustomerSince && customer.clienteDesde) {
    newEvents.push({
      leadId,
      kind: ERP_CUSTOMER_SINCE_EVENT,
      occurredAt: new Date(customer.clienteDesde),
      metadata: { source: "erp", customerCode: customer.codigo },
    });
  }
  if (newEvents.length > 0) {
    await prisma.leadJourneyEvent.createMany({ data: newEvents });
  }
  return newEvents.filter((event) => event.kind === ERP_PURCHASE_EVENT).length;
}

export async function importErpCustomersPage(input: {
  organizationId: string;
  trackingId: string;
  statusId: string;
  customers: ErpCustomer[];
  syncedAt: Date;
  now?: Date;
}): Promise<ImportPageReport> {
  const report: ImportPageReport = { ...EMPTY_IMPORT_REPORT, read: input.customers.length };
  if (input.customers.length === 0) return report;

  const tagCache = await loadTagCache(input.organizationId);
  let nextOrder = await nextOrderInStatus(input.statusId);
  const now = input.now ?? new Date();

  for (const customer of input.customers) {
    try {
      const phone = pickPhone(customer);
      let leadId = await findExistingLead(input.organizationId, customer, phone);

      if (leadId) {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { email: true, document: true },
        });
        // Lead que já existe só ganha o que falta: etapa, responsável e origem ficam (CB-3).
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            ...(!lead?.email && customer.email ? { email: customer.email } : {}),
            ...(!lead?.document && customer.documento ? { document: customer.documento } : {}),
          },
        });
        report.updated += 1;
      } else {
        if (!phone && !customer.documento) {
          report.skippedNoContact += 1;
          continue;
        }
        const created = await prisma.lead.create({
          data: {
            name: customer.nome,
            phone,
            email: customer.email,
            document: customer.documento,
            source: "ERP",
            statusId: input.statusId,
            trackingId: input.trackingId,
            order: nextOrder,
            currentAction: LeadAction.ACTIVE,
            isActive: true,
            createdAt: toDate(customer.clienteDesde) ?? now,
          },
          select: { id: true },
        });
        nextOrder = nextOrder.plus(1);
        leadId = created.id;
        report.created += 1;
      }

      await upsertProfile(input.organizationId, leadId, customer, input.syncedAt);
      const tagIds = await ensureTagIds(
        input.organizationId,
        tagCache,
        buildCustomerTags(customer, now),
      );
      await syncManagedTags(leadId, tagCache.groupId, tagIds);
      report.purchasesAdded += await addPurchaseEvents(leadId, customer);
    } catch (error) {
      report.failed += 1;
      console.error("[erp-carteira] falha ao importar cliente", customer.codigo, error);
    }
  }
  return report;
}
