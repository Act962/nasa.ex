import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import type { Prisma } from "@/generated/prisma/client";
import { addRecipientsFromCsvSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { loadBroadcastForOrg } from "@/features/campanhas/server/lib/broadcast-access";

/**
 * Adiciona destinatários a partir de linhas de CSV/XLSX já parseadas no client
 * (`leadId: null`). Normaliza telefone, dedupe por `(broadcast, phone)` e
 * atualiza `totalRecipients`.
 */
export const addRecipientsFromCsv = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(addRecipientsFromCsvSchema)
  .handler(async ({ input, context }) => {
    const { org } = context;
    const broadcast = await loadBroadcastForOrg(input.broadcastId, org.id);

    const seen = new Set<string>();
    const rows: Prisma.BroadcastRecipientCreateManyInput[] = input.rows.flatMap(
      (row) => {
        const phone = normalizePhone(row.phone);
        if (!phone || seen.has(phone)) return [];
        seen.add(phone);
        return [
          {
            broadcastId: broadcast.id,
            leadId: null,
            name: row.name ?? null,
            phone,
            variables: row.variables ?? undefined,
          },
        ];
      },
    );

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
