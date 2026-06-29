import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const externalContactShape = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  document: z.string().nullable(),
  source: z.enum(["lead", "forge"]),
  sourceLabel: z.string(),
});

export const listExternalContacts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List external contacts from leads and forge", tags: ["Payment"] })
  .input(z.object({ search: z.string().optional() }))
  .output(z.object({ contacts: z.array(externalContactShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const orgId = context.org.id;
      const search = input.search?.trim();

      const searchFilter = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};

      // Todos os leads do tracking da org
      const leads = await prisma.lead.findMany({
        where: {
          tracking: { organizationId: orgId },
          isActive: true,
          ...searchFilter,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          document: true,
          tracking: { select: { name: true } },
          // Verifica se tem proposta ativa no Forge
          forgeProposals: {
            where: { status: { in: ["ENVIADA", "VISUALIZADA", "PAGA"] } },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
        take: 80,
      });

      const results: z.infer<typeof externalContactShape>[] = leads.map((l) => ({
        id: `lead:${l.id}`,
        name: l.name,
        email: l.email ?? null,
        phone: l.phone ?? null,
        document: l.document ?? null,
        source: l.forgeProposals.length > 0 ? ("forge" as const) : ("lead" as const),
        sourceLabel:
          l.forgeProposals.length > 0
            ? `${l.tracking.name} · Forge`
            : l.tracking.name,
      }));

      return { contacts: results };
    } catch (err) {
      console.error("[payment/external-contacts]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
