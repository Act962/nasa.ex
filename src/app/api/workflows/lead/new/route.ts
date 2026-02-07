import { inngest } from "@/inngest/client";
import { sendWorkflowExecution } from "@/inngest/utils";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get("trackingId");
    const leadId = url.searchParams.get("leadId");

    // cmkfzj9w40000uwc11q5wq84i

    if (!trackingId) {
      return NextResponse.json(
        { error: "Tracking ID is required" },
        { status: 400 },
      );
    }

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        statusId: true,
        trackingId: true,
        responsibleId: true,
        isActive: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 400 });
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
        lead,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workflow executed successfully",
    });
  } catch (error) {
    console.error("Error new lead", error);
    return NextResponse.json(
      { error: "Failed to process New Lead" },
      { status: 500 },
    );
  }
}
