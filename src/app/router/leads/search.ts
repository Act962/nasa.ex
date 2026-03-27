import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";

// 🟧 LIST ALL
export const searchLeads = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/leads/search",
    summary: "Search leads with optional filters, pagination, and sorting",
    tags: ["Leads"],
  })
  .input(
    z.object({
      statusId: z.string().optional(),
      trackingId: z.string().optional(),
      search: z.string().optional(), // busca por nome, email ou telefone
      page: z.number().default(1),
      limit: z.number().max(100).default(20),
      orderBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
      order: z.enum(["asc", "desc"]).default("desc"),
    }),
  )
  .output(
    z.object({
      leads: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          phone: z.string().nullable(),
          email: z.string().nullable(),
          createdAt: z.date(),
        }),
      ),
      total: z.number(),
      page: z.number(),
      totalPages: z.number(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { page, limit, statusId, trackingId, search, orderBy, order } =
        input;

      const where: any = {
        tracking: {
          organizationId: context.org.id,
        },
      };

      if (statusId) where.statusId = statusId;
      if (trackingId) where.trackingId = trackingId;

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const total = await prisma.lead.count({ where });

      const leads = await prisma.lead.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          createdAt: true,
        },
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        leads,
        total,
        page,
        totalPages,
      };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
