import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { addRecipientsFromContactsSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { isBroadcastEditable } from "@/features/campanhas/lib/broadcast-status";
import { toWhatsAppBrazilPhone } from "@/features/campanhas/lib/whatsapp-phone";
import { buildContactsWhere } from "@/features/campanhas/lib/contacts-query";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";
import { reopenBroadcast } from "@/features/campanhas/server/lib/reopen-broadcast";

/**
 * Atrela contatos (leads) a uma campanha como destinatários. Aceita uma seleção
 * explícita (`leadIds`) ou "todos que casam com o filtro" (`allMatching`).
 * Normaliza telefone, dedupe por `(broadcast, phone)` e atualiza
 * `totalRecipients`. Aceita broadcast `DRAFT` ou `FAILED` — se `FAILED`, reabre
 * (volta a `DRAFT`) antes de atrelar, permitindo corrigir e redisparar.
 */
export const addRecipientsFromContacts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(addRecipientsFromContactsSchema)
  .handler(async ({ input, context, errors }) => {
    const { org, user } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    if (!isBroadcastEditable(broadcast.status)) {
      throw errors.BAD_REQUEST({
        message:
          "Só é possível adicionar contatos a uma campanha em rascunho ou que falhou.",
      });
    }

    // Campanha que falhou volta a rascunho ao receber novos destinatários,
    // permitindo corrigir a audiência e redisparar.
    if (broadcast.status === "FAILED") {
      await reopenBroadcast(broadcast.id);
    }

    const where = input.leadIds?.length
      ? {
          id: { in: input.leadIds },
          tracking: { organizationId: org.id },
          phone: { not: null },
        }
      : buildContactsWhere(org.id, input.allMatching ?? {});

    const leads = await prisma.lead.findMany({
      where,
      select: { id: true, name: true, phone: true },
    });

    const seen = new Set<string>();
    const rows = leads.flatMap((lead) => {
      const phone = toWhatsAppBrazilPhone(normalizePhone(lead.phone ?? ""));
      if (!phone || seen.has(phone)) return [];
      seen.add(phone);
      return [{ broadcastId: broadcast.id, leadId: lead.id, name: lead.name, phone }];
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

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      appSlug: "campanhas",
      action: "broadcast.recipients_added",
      actionLabel: `Atrelou ${inserted.count} contato(s) à campanha "${broadcast.name}"`,
      resource: "broadcast",
      resourceId: broadcast.id,
      metadata: { added: inserted.count, totalRecipients },
    }).catch(() => {});

    return { added: inserted.count, totalRecipients, broadcastId: broadcast.id };
  });
