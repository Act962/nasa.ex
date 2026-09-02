import { inngest } from "@/inngest/client";
import { dispatchNewLead } from "@/inngest/utils";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { truncateLeadMessageText } from "@/features/tracking-executions/lib/lead-message";

/**
 * Mensagem que criou o lead, quando o caller tem uma (webhook de WhatsApp).
 * Opcional — lead de formulário e In-Chat identify nascem sem mensagem.
 */
const bodySchema = z.object({
  leadMessage: z
    .object({
      text: z.string(),
      messageId: z.string().optional(),
      mediaType: z
        .enum(["image", "video", "audio", "document", "sticker"])
        .optional(),
      sentAt: z.string().optional(),
    })
    .optional(),
});

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

    // Body inválido não pode impedir o gatilho — o lead já foi criado. Sem
    // mensagem, o workflow roda igual e o FILTER_LEAD trata a ausência.
    const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
    const leadMessage = parsedBody.success ? parsedBody.data.leadMessage : undefined;

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
        isActive: true,
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

    await Promise.all(
      workflows.map((workflow) =>
        dispatchNewLead({
          workflowId: workflow.id,
          lead,
          leadMessage: leadMessage
            ? {
                ...leadMessage,
                text: truncateLeadMessageText(leadMessage.text),
                source: "TRIGGER_EVENT",
              }
            : null,
        }),
      ),
    );

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
