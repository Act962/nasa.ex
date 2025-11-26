import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/leads",
    summary: "Get all leads",
  })
  .output(
    z.object({
      leads: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          phone: z.string().nullable(),
          email: z.string().nullable(),
          createdAt: z.date(),
          tracking: z.object({
            id: z.string(),
            name: z.string(),
          }),
          status: z.object({
            id: z.string(),
            name: z.string(),
            color: z.string().nullable(),
          }),
        })
      ),
    })
  )
  .handler(async ({ errors, context }) => {
    try {
      const { org } = context;

      if (!org) {
        throw errors.BAD_REQUEST;
      }

      const leads = await prisma.lead.findMany({
        where: {
          tracking: {
            organizationId: org.id,
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          createdAt: true,
          tracking: {
            select: {
              id: true,
              name: true,
            },
          },
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        leads,
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
