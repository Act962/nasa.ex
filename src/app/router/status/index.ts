import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List all status",
    tags: ["Status"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      status: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z.string().nullable(),
          order: z.number(),
          leads: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().nullable(),
              order: z.number(),
              phone: z.string().nullable(),
              statusId: z.string(),
            })
          ),
        })
      ),
    })
  )
  .handler(async ({ input }) => {
    const status = await prisma.status.findMany({
      where: {
        trackingId: input.trackingId,
      },
      orderBy: {
        order: "asc",
      },
      include: {
        leads: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            statusId: true,
            order: true,
          },
        },
      },
    });

    return {
      status: status,
    };
  });

export const createStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a status",
    tags: ["Status"],
  })
  .input(
    z.object({
      name: z.string(),
      color: z.string().optional(),
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      statusName: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const lastStatus = await prisma.status.findFirst({
      where: {
        trackingId: input.trackingId,
      },
      orderBy: {
        order: "desc",
      },
    });

    const order = lastStatus ? lastStatus.order + 1 : 0;

    const status = await prisma.status.create({
      data: {
        name: input.name,
        color: input.color,
        trackingId: input.trackingId,
        order,
      },
    });

    return {
      statusName: status.name,
    };
  });

export const updateStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update a status",
    tags: ["Status"],
  })
  .input(
    z.object({
      name: z.string(),
      color: z.string().optional(),
      statusId: z.string(),
    })
  )
  .output(
    z.object({
      statusName: z.string(),
    })
  )
  .handler(async ({ input, errors }) => {
    const statusExists = await prisma.status.findUnique({
      where: {
        id: input.statusId,
      },
    });

    if (!statusExists) {
      throw errors.NOT_FOUND;
    }

    const status = await prisma.status.update({
      where: {
        id: input.statusId,
      },
      data: {
        name: input.name,
        color: input.color,
      },
    });

    return {
      statusName: status.name,
    };
  });
