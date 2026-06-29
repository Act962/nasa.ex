import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listInstances = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List WhatsApp instances", tags: ["Admin"] })
  .input(z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    page:   z.coerce.number().int().positive().default(1),
    limit:  z.coerce.number().int().positive().max(100).default(25),
  }))
  .output(z.object({
    instances: z.array(z.object({
      id:           z.string(),
      instanceName: z.string(),
      status:       z.string(),
      phoneNumber:  z.string().nullable(),
      profileName:  z.string().nullable(),
      isActive:     z.boolean(),
      isBusiness:   z.boolean(),
      orgId:        z.string(),
      orgName:      z.string(),
      createdAt:    z.string(),
      lastSyncAt:   z.string().nullable(),
    })),
    total: z.number(),
  }))
  .handler(async ({ input }) => {
    const { search, status, page, limit } = input;
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { instanceName: { contains: search, mode: "insensitive" } },
        { phoneNumber:  { contains: search, mode: "insensitive" } },
        { organization: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (status) where.status = status;

    const [instances, total] = await Promise.all([
      prisma.whatsAppInstance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, instanceName: true, status: true,
          phoneNumber: true, profileName: true,
          isActive: true, isBusiness: true,
          organizationId: true, createdAt: true, lastSyncAt: true,
          organization: { select: { name: true } },
          // NEVER select apiKey or baseUrl
        },
      }),
      prisma.whatsAppInstance.count({ where }),
    ]);

    return {
      instances: instances.map((i) => ({
        id:           i.id,
        instanceName: i.instanceName,
        status:       i.status,
        phoneNumber:  i.phoneNumber ?? null,
        profileName:  i.profileName ?? null,
        isActive:     i.isActive,
        isBusiness:   i.isBusiness,
        orgId:        i.organizationId,
        orgName:      i.organization.name,
        createdAt:    i.createdAt.toISOString(),
        lastSyncAt:   i.lastSyncAt?.toISOString() ?? null,
      })),
      total,
    };
  });
