import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { TypeAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";

export const listActionsByLead = base

  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/leads/actions",
    summary: "Get all leads",
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .output(
    z.object({
      actions: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().nullable(),
          score: z.number().default(0),
          isDone: z.boolean().default(false),
          type: z.enum(TypeAction),
          trackingId: z.string().nullable(),
          organizationId: z.string().nullable(),
          createdBy: z.string(),
          leadId: z.string().nullable(),
          startDate: z.date().nullable(),
          endDate: z.date().nullable(),
          createdAt: z.date(),
          responsibles: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              profile: z.string().nullable(),
              email: z.string(),
            }),
          ),
        }),
      ),
    }),
  )
  .handler(async ({ errors, input }) => {
    try {
      const actions = await prisma.action.findMany({
        where: {
          leadId: input.leadId,
        },
        include: {
          responsibles: {
            include: {
              user: true,
            },
          },
        },
      });
      const actionsFormatted = actions.map((action) => ({
        ...action,
        responsibles: action.responsibles.map((responsible) => ({
          id: responsible.user.id,
          profile: responsible.user.image,
          email: responsible.user.email,
          name: responsible.user.name,
        })),
      }));

      return {
        actions: actionsFormatted,
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
