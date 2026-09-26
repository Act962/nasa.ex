import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const PURCHASE_SOURCES = ["payment", "contract", "catalog", "both"] as const;
type PurchaseSource = (typeof PURCHASE_SOURCES)[number];

/**
 * Retorna um mapa `leadId → { lastPurchaseAt, source }` pros leads da lista.
 *
 * "Compra" é o MAIS RECENTE entre:
 *   - PaymentEntry: RECEIVABLE + status PAID, com leadId = X, ordenado por paidAt DESC
 *   - ForgeContract: status ATIVO, cujo ForgeProposal.clientId = X, por startDate DESC
 *   - CatalogOrder: status PAID/IN_LOGISTICS/DELIVERED, por paidAt DESC
 *
 * Sem compra → `lastPurchaseAt: null` (cinza no card).
 *
 * Chamado uma vez por render de coluna/board — batches todos os leads da vez.
 */
export const getLeadPurchases = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Get last-purchase timestamps for a batch of leads",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      // Modo 1: lista explícita de leads (batch pontual).
      leadIds: z.array(z.string()).max(500).optional(),
      // Modo 2: todos os leads de um tracking (usado pelo board — 1 request
      // dedupa entre todos os cards via React Query).
      trackingId: z.string().optional(),
    }),
  )
  .output(
    z.object({
      purchases: z.record(
        z.string(),
        z.object({
          lastPurchaseAt: z.string().nullable(),
          source: z.enum(PURCHASE_SOURCES).nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      let leadIds = input.leadIds ?? [];
      if (leadIds.length === 0 && input.trackingId) {
        const trackingLeads = await prisma.lead.findMany({
          where: { trackingId: input.trackingId },
          select: { id: true },
        });
        leadIds = trackingLeads.map((lead) => lead.id);
      }
      if (leadIds.length === 0) return { purchases: {} };

      const [paymentRows, contractRows, catalogOrderRows] = await Promise.all([
        prisma.paymentEntry.groupBy({
          by: ["leadId"],
          where: {
            organizationId: context.org.id,
            type: "RECEIVABLE",
            status: "PAID",
            leadId: { in: leadIds },
          },
          _max: { paidAt: true },
        }),
        prisma.forgeContract.findMany({
          where: {
            organizationId: context.org.id,
            status: "ATIVO",
            proposal: { clientId: { in: leadIds } },
          },
          select: {
            startDate: true,
            proposal: { select: { clientId: true } },
          },
        }),
        prisma.catalogOrder.groupBy({
          by: ["leadId"],
          where: {
            organizationId: context.org.id,
            status: { in: ["PAID", "IN_LOGISTICS", "DELIVERED"] },
            leadId: { in: leadIds },
          },
          _max: { paidAt: true, createdAt: true },
        }),
      ]);

      const purchases: Record<
        string,
        { lastPurchaseAt: string | null; source: PurchaseSource | null }
      > = {};
      const latestDateByLead: Record<string, Date> = {};

      for (const leadId of leadIds) {
        purchases[leadId] = { lastPurchaseAt: null, source: null };
      }

      // Mantém a origem da compra mais recente; empate exato entre origens vira "both".
      const registerPurchase = (
        leadId: string,
        purchaseDate: Date,
        purchaseSource: Exclude<PurchaseSource, "both">,
      ) => {
        const current = purchases[leadId];
        const currentDate = latestDateByLead[leadId];
        if (!current || !currentDate || purchaseDate > currentDate) {
          latestDateByLead[leadId] = purchaseDate;
          purchases[leadId] = {
            lastPurchaseAt: purchaseDate.toISOString(),
            source: purchaseSource,
          };
          return;
        }
        if (
          purchaseDate.getTime() === currentDate.getTime() &&
          current.source !== purchaseSource
        ) {
          current.source = "both";
        }
      };

      for (const row of paymentRows) {
        if (!row.leadId || !row._max.paidAt) continue;
        registerPurchase(row.leadId, row._max.paidAt, "payment");
      }

      for (const row of contractRows) {
        const leadId = row.proposal?.clientId;
        if (!leadId) continue;
        registerPurchase(leadId, row.startDate, "contract");
      }

      for (const row of catalogOrderRows) {
        const purchaseDate = row._max.paidAt ?? row._max.createdAt;
        if (!purchaseDate) continue;
        registerPurchase(row.leadId, purchaseDate, "catalog");
      }

      return { purchases };
    } catch (err) {
      console.error("[trackings/getLeadPurchases]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
