import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { addRecipientsFromLeadsSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { buildLeadAudienceWhere } from "@/features/campanhas/lib/audience-query";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/**
 * Resolve leads do tracking de origem (com filtros) e adiciona como
 * destinatários da campanha. Normaliza telefone, dedupe por `(broadcast, phone)`
 * e atualiza o contador `totalRecipients`.
 */
export const addRecipientsFromLeads = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(addRecipientsFromLeadsSchema)
  .handler(async ({ input, context }) => {
    const { org } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    const leads = await prisma.lead.findMany({
      where: buildLeadAudienceWhere(broadcast.trackingId, input.filters),
      select: { id: true, name: true, phone: true },
    });

    const seen = new Set<string>();
    const rows = leads.flatMap((lead) => {
      const phone = normalizePhone(lead.phone ?? "");
      if (!phone || seen.has(phone)) return [];
      seen.add(phone);
      return [
        {
          broadcastId: broadcast.id,
          leadId: lead.id,
          name: lead.name,
          phone,
        },
      ];
    });

    const inserted = rows.length
      ? await prisma.broadcastRecipient.createMany({
          data: rows,
          skipDuplicates: true,
        })
      : { count: 0 };

    const totalRecipients = await prisma.broadcastRecipient.count({
      where: { broadcastId: broadcast.id },
    });
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { totalRecipients },
    });

    return { added: inserted.count, totalRecipients };
  });
