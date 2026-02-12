import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// 🟨 GET
export const getLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Retrieve a lead by ID or by phone + trackingId",
    tags: ["Leads"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .output(
    z.object({
      lead: z.object({
        // Campos do lead
        id: z.string(),
        name: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        description: z.string().nullable(),
        profile: z.string().nullable(),
        statusId: z.string(),
        trackingId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        responsible: z
          .object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            createdAt: z.date(),
            updatedAt: z.date(),
            emailVerified: z.boolean(),
            image: z.string().nullable(),
          })
          .nullable(),

        // Relacionamento status
        status: z.object({
          id: z.string(),
          name: z.string(),
          trackingId: z.string(),
          order: z.number(),
          color: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),

        // Relacionamento tracking
        tracking: z.object({
          id: z.string(),
          name: z.string(),
          organizationId: z.string(),
          description: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
      }),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const lead = await prisma.lead.findUnique({
        where: {
          id: input.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          description: true,
          profile: true,
          statusId: true,
          trackingId: true,
          createdAt: true,
          updatedAt: true,
          responsible: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              updatedAt: true,
              emailVerified: true,
              image: true,
            },
          },
          status: {
            select: {
              id: true,
              name: true,
              trackingId: true,
              order: true,
              color: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          tracking: {
            select: {
              id: true,
              name: true,
              organizationId: true,
              description: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!lead) {
        throw errors.NOT_FOUND;
      }

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
