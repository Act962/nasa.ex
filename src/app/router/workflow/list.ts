import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listWorkflows = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      workflows: z.array(z.custom<Workflow>()),
    })
  )
  .handler(async ({ input, errors }) => {
    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND({
        message: "Tracking não encontrado",
      });
    }

    const workflows = await prisma.workflow.findMany({
      where: {
        trackingId: input.trackingId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      workflows,
    };
  });
