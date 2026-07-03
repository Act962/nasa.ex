import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Retorna um mapa `leadId → { lastPurchaseAt, source }` pros leads da lista.
 *
 * "Compra" é o MAIS RECENTE entre:
 *   - PaymentEntry: RECEIVABLE + status PAID, com leadId = X, ordenado por paidAt DESC
 *   - ForgeContract: status ATIVO, cujo ForgeProposal.clientId = X, por startDate DESC
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
          source: z.enum(["payment", "contract", "both"]).nullable(),
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

      const [paymentRows, contractRows] = await Promise.all([
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
      ]);

      const purchases: Record<
        string,
        { lastPurchaseAt: string | null; source: "payment" | "contract" | "both" | null }
      > = {};

      for (const leadId of leadIds) {
        purchases[leadId] = { lastPurchaseAt: null, source: null };
      }

      for (const row of paymentRows) {
        if (!row.leadId || !row._max.paidAt) continue;
        purchases[row.leadId] = {
          lastPurchaseAt: row._max.paidAt.toISOString(),
          source: "payment",
        };
      }

      // Reduz contratos por lead → mantém o startDate mais recente
      const latestByLead: Record<string, Date> = {};
      for (const row of contractRows) {
        const leadId = row.proposal?.clientId;
        if (!leadId) continue;
        if (!latestByLead[leadId] || row.startDate > latestByLead[leadId]) {
          latestByLead[leadId] = row.startDate;
        }
      }

      for (const [leadId, contractDate] of Object.entries(latestByLead)) {
        const current = purchases[leadId];
        if (!current || current.lastPurchaseAt === null) {
          purchases[leadId] = {
            lastPurchaseAt: contractDate.toISOString(),
            source: "contract",
          };
          continue;
        }
        const currentDate = new Date(current.lastPurchaseAt);
        if (contractDate > currentDate) {
          purchases[leadId] = {
            lastPurchaseAt: contractDate.toISOString(),
            source: current.source === "payment" ? "both" : "contract",
          };
        } else if (contractDate.getTime() === currentDate.getTime()) {
          purchases[leadId].source = "both";
        }
      }

      return { purchases };
    } catch (err) {
      console.error("[trackings/getLeadPurchases]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
