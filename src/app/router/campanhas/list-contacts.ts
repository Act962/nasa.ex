import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { listContactsSchema } from "@/features/campanhas/schema/broadcast-schemas";
import { buildContactsWhere } from "@/features/campanhas/lib/contacts-query";

/**
 * Base unificada de contatos do app de Campanhas: lista leads de todos os
 * trackings da org (ou de um tracking específico) com telefone, aplicando os
 * filtros de audiência. Paginação por offset (page/pageSize) + `totalCount`.
 */
export const listContacts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(listContactsSchema)
  .handler(async ({ input, context }) => {
    const { org } = context;
    const { page, pageSize, ...filters } = input;
    const where = buildContactsWhere(org.id, filters);

    const totalCount = await prisma.lead.count({ where });

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        temperature: true,
        currentAction: true,
        createdAt: true,
        tracking: { select: { id: true, name: true } },
        status: { select: { id: true, name: true, color: true } },
        responsible: { select: { name: true, image: true } },
        leadTags: {
          select: { tag: { select: { name: true, color: true } } },
        },
      },
    });

    return {
      totalCount,
      contacts: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        temperature: lead.temperature,
        currentAction: lead.currentAction,
        createdAt: lead.createdAt,
        trackingName: lead.tracking.name,
        status: lead.status
          ? { name: lead.status.name, color: lead.status.color ?? "#94a3b8" }
          : null,
        responsible: lead.responsible,
        tags: lead.leadTags.map((leadTag) => ({
          name: leadTag.tag.name,
          color: leadTag.tag.color ?? "#64748b",
        })),
      })),
    };
  });
