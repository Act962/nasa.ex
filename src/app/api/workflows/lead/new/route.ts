import { inngest } from "@/inngest/client";
import { sendWorkflowExecution } from "@/inngest/utils";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get("trackingId");

    if (!trackingId) {
      return NextResponse.json(
        { error: "Tracking ID is required" },
        { status: 500 },
      );
    }

    const workflows = await prisma.workflow.findMany({
      where: {
        trackingId,
        nodes: {
          some: {
            type: "NEW_LEAD",
          },
        },
      },
    });

    if (workflows.length === 0) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 200 },
      );
    }

    await sendWorkflowExecution({
      workflowId: workflows[0].id,
      initialData: {
        lead: {
          id: "123",
          name: "Eyshila",
          email: "eyshila@example.com",
        },
      },
    });

    return NextResponse.json(workflows);
  } catch (error) {
    console.error("Error new lead", error);
    return NextResponse.json(
      { error: "Failed to process New Lead" },
      { status: 500 },
    );
  }
}
