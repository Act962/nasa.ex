import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { Connection, Node, Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

type WorkflowWithGraph = Workflow & {
  nodes: Node[];
  connections: Connection[];
};

export const listWorkflows = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      workflows: z.array(z.custom<WorkflowWithGraph>()),
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
      include: {
        nodes: true,
        connections: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      workflows,
    };
  });
