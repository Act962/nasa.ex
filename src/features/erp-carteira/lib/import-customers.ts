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

type ExistingLead = { id: string; email: string | null; document: string | null };

/**
 * Tudo o que a página precisa ler, numa leva só (antes eram ~8 consultas por cliente): perfis já importados,
 * leads por telefone e por documento e as compras que já estão na Jornada.
 */
type PageLookup = {
  leadIdByCode: Map<string, string>;
  codesByLeadId: Map<string, string[]>;
  leadByPhone: Map<string, ExistingLead>;
  leadByDocument: Map<string, ExistingLead>;
  leadById: Map<string, ExistingLead>;
  knownOrdersByLeadId: Map<string, Set<string>>;
  leadsWithCustomerSince: Set<string>;
};

const LEAD_FIELDS = { id: true, email: true, document: true } as const;

async function loadPageLookup(organizationId: string, customers: ErpCustomer[]): Promise<PageLookup> {
  const codes = customers.map((customer) => customer.codigo);
  const phoneVariants = customers.flatMap((customer) => {
    const phone = pickPhone(customer);
    return phone ? waIdLookupVariants(phone) : [];
  });
  const documents = customers.flatMap((customer) => (customer.documento ? [customer.documento] : []));

  const [profiles, leadsByPhone, leadsByDocument] = await Promise.all([
    prisma.leadErpProfile.findMany({
      where: { organizationId, customerCodes: { hasSome: codes } },
      select: { leadId: true, customerCodes: true, lead: { select: LEAD_FIELDS } },
    }),
    phoneVariants.length > 0
      ? prisma.lead.findMany({
          where: { tracking: { organizationId }, phone: { in: phoneVariants } },
          orderBy: { createdAt: "asc" },
          select: { ...LEAD_FIELDS, phone: true },
        })
      : [],
    documents.length > 0
      ? prisma.lead.findMany({
          where: { tracking: { organizationId }, document: { in: documents } },
          orderBy: { createdAt: "asc" },
          select: LEAD_FIELDS,
        })
      : [],
  ]);

  const lookup: PageLookup = {
    leadIdByCode: new Map(),
    codesByLeadId: new Map(),
    leadByPhone: new Map(),
    leadByDocument: new Map(),
    leadById: new Map(),
    knownOrdersByLeadId: new Map(),
    leadsWithCustomerSince: new Set(),
  };
  for (const profile of profiles) {
    lookup.codesByLeadId.set(profile.leadId, profile.customerCodes);
    lookup.leadById.set(profile.leadId, profile.lead);
    for (const code of profile.customerCodes) lookup.leadIdByCode.set(code, profile.leadId);
  }
  // `orderBy createdAt asc`: o primeiro lead visto para um telefone/documento é o mais antigo, e ele vence.
  for (const lead of leadsByPhone) {
    if (lead.phone && !lookup.leadByPhone.has(lead.phone)) lookup.leadByPhone.set(lead.phone, lead);
    lookup.leadById.set(lead.id, lead);
  }
  for (const lead of leadsByDocument) {
    if (lead.document && !lookup.leadByDocument.has(lead.document)) lookup.leadByDocument.set(lead.document, lead);
    lookup.leadById.set(lead.id, lead);
  }

  const existingLeadIds = [...lookup.leadById.keys()];
  if (existingLeadIds.length > 0) {
    const events = await prisma.leadJourneyEvent.findMany({
      where: { leadId: { in: existingLeadIds }, kind: { in: [ERP_PURCHASE_EVENT, ERP_CUSTOMER_SINCE_EVENT] } },
      select: { leadId: true, kind: true, metadata: true },
    });
    for (const event of events) {
      if (event.kind === ERP_CUSTOMER_SINCE_EVENT) {
        lookup.leadsWithCustomerSince.add(event.leadId);
        continue;
      }
      const orderNumber = (event.metadata as { orderNumber?: unknown } | null)?.orderNumber;
      if (typeof orderNumber !== "string") continue;
      const known = lookup.knownOrdersByLeadId.get(event.leadId) ?? new Set<string>();
      known.add(orderNumber);
      lookup.knownOrdersByLeadId.set(event.leadId, known);
    }
  }
  return lookup;
}

function findExistingLead(lookup: PageLookup, customer: ErpCustomer, phone: string | null): ExistingLead | null {
  const byCode = lookup.leadIdByCode.get(customer.codigo);
  if (byCode) return lookup.leadById.get(byCode) ?? { id: byCode, email: null, document: null };
  if (phone) {
    for (const variant of waIdLookupVariants(phone)) {
      const lead = lookup.leadByPhone.get(variant);
      if (lead) return lead;
    }
  }
  if (customer.documento) return lookup.leadByDocument.get(customer.documento) ?? null;
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

async function upsertProfile(params: {
  organizationId: string;
  leadId: string;
  customer: ErpCustomer;
  syncedAt: Date;
  currentCodes: string[];
}) {
  const { customer } = params;
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
    syncedAt: params.syncedAt,
  };
  await prisma.leadErpProfile.upsert({
    where: { leadId: params.leadId },
    create: { leadId: params.leadId, organizationId: params.organizationId, customerCodes: [customer.codigo], ...profileData },
    update: {
      customerCodes: [...new Set([...params.currentCodes, customer.codigo])],
      ...profileData,
    },
  });
}

/** Compras novas viram eventos da Jornada na data real; a chave é o número do pedido no ERP. */
function buildPurchaseEvents(
  leadId: string,
  customer: ErpCustomer,
  lookup: PageLookup,
): Prisma.LeadJourneyEventCreateManyInput[] {
  const knownOrders = lookup.knownOrdersByLeadId.get(leadId) ?? new Set<string>();
  const branchNameByCode = new Map(customer.filial ? [[customer.filial.codigo, customer.filial.nome]] : []);
  const events: Prisma.LeadJourneyEventCreateManyInput[] = customer.pedidos
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
  // Dois códigos do ERP no mesmo lead (CB-2): o segundo não repete pedido nem o "cliente desde".
  for (const order of customer.pedidos) knownOrders.add(order.numero);
  lookup.knownOrdersByLeadId.set(leadId, knownOrders);
  if (!lookup.leadsWithCustomerSince.has(leadId) && customer.clienteDesde) {
    events.push({
      leadId,
      kind: ERP_CUSTOMER_SINCE_EVENT,
      occurredAt: new Date(customer.clienteDesde),
      metadata: { source: "erp", customerCode: customer.codigo },
    });
    lookup.leadsWithCustomerSince.add(leadId);
  }
  return events;
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

  const [tagCache, lookup] = await Promise.all([
    loadTagCache(input.organizationId),
    loadPageLookup(input.organizationId, input.customers),
  ]);
  let nextOrder = await nextOrderInStatus(input.statusId);
  const now = input.now ?? new Date();
  const journeyEvents: Prisma.LeadJourneyEventCreateManyInput[] = [];

  for (const customer of input.customers) {
    try {
      const phone = pickPhone(customer);
      const existing = findExistingLead(lookup, customer, phone);
      let leadId: string;

      if (existing) {
        leadId = existing.id;
        // Lead que já existe só ganha o que falta: etapa, responsável e origem ficam (CB-3).
        const missing = {
          ...(!existing.email && customer.email ? { email: customer.email } : {}),
          ...(!existing.document && customer.documento ? { document: customer.documento } : {}),
        };
        if (Object.keys(missing).length > 0) {
          await prisma.lead.update({ where: { id: leadId }, data: missing });
          Object.assign(existing, missing);
        }
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
          select: LEAD_FIELDS,
        });
        nextOrder = nextOrder.plus(1);
        leadId = created.id;
        // Outro código do ERP com o mesmo telefone/documento na página cai neste lead, não num novo.
        lookup.leadById.set(created.id, created);
        if (phone) lookup.leadByPhone.set(phone, created);
        if (customer.documento) lookup.leadByDocument.set(customer.documento, created);
        report.created += 1;
      }

      const currentCodes = lookup.codesByLeadId.get(leadId) ?? [];
      await upsertProfile({ organizationId: input.organizationId, leadId, customer, syncedAt: input.syncedAt, currentCodes });
      lookup.codesByLeadId.set(leadId, [...new Set([...currentCodes, customer.codigo])]);
      lookup.leadIdByCode.set(customer.codigo, leadId);

      const tagIds = await ensureTagIds(input.organizationId, tagCache, buildCustomerTags(customer, now));
      await syncManagedTags(leadId, tagCache.groupId, tagIds);
      const events = buildPurchaseEvents(leadId, customer, lookup);
      journeyEvents.push(...events);
      report.purchasesAdded += events.filter((event) => event.kind === ERP_PURCHASE_EVENT).length;
    } catch (error) {
      report.failed += 1;
      console.error("[erp-carteira] falha ao importar cliente", customer.codigo, error);
    }
  }

  if (journeyEvents.length > 0) {
    await prisma.leadJourneyEvent.createMany({ data: journeyEvents });
  }
  return report;
}
