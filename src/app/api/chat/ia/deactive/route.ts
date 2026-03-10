import { sendWorkflowExecution } from "@/inngest/utils";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  leadId: z.string(),
  trackingId: z.string(),
});

export async function POST(request: Request) {
  const body = await request.json();

  const bodyParsed = schema.safeParse(body);

  if (!bodyParsed.success) {
    return NextResponse.json({
      status: "error",
      message: "Invalid body",
    });
  }

  const { leadId, trackingId } = bodyParsed.data;

  const lead = await prisma.lead.findUnique({
    where: {
      id: leadId,
    },
  });

  if (!lead) {
    return NextResponse.json({
      status: "error",
      message: "Lead not found",
    });
  }

  const leadUpdated = await prisma.lead.update({
    where: {
      id: leadId,
    },
    data: {
      isActive: false,
    },
  });

  const workflow = await prisma.workflow.findMany({
    where: {
      trackingId,
      nodes: {
        some: {
          type: "AI_FINISHED",
        },
      },
    },
  });

  await Promise.all(
    workflow.map((workflow) =>
      sendWorkflowExecution({
        workflowId: workflow.id,
        initialData: {
          lead,
        },
      }),
    ),
  );

  return NextResponse.json({
    status: "success",
    lead: leadUpdated,
  });
}
