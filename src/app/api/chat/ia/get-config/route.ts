import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const formSchema = z.object({
  trackingId: z.string(),
  leadId: z.string(),
});

export async function POST(request: Request) {
  const body = await request.json();

  const bodyParsed = formSchema.safeParse(body);

  if (!bodyParsed.success) {
    return NextResponse.json({
      status: "error",
      message: "Invalid body",
    });
  }

  const { trackingId, leadId } = bodyParsed.data;

  const tracking = await prisma.tracking.findUnique({
    where: {
      id: trackingId,
    },
    select: {
      id: true,
      aiSettings: true,
      whatsappInstance: {
        select: {
          apiKey: true,
          baseUrl: true,
        },
      },
    },
  });

  if (!tracking) {
    return NextResponse.json({
      status: "error",
      message: "Tracking not found",
    });
  }

  const lead = await prisma.lead.findUnique({
    where: {
      id: leadId,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      phone: true,
      profile: true,
      conversation: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({
      status: "error",
      message: "Lead not found",
    });
  }

  return NextResponse.json({
    status: "success",
    tracking,
    lead,
  });
}
