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

  const { leadId } = bodyParsed.data;

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

  return NextResponse.json({
    status: "success",
    lead: leadUpdated,
  });
}
