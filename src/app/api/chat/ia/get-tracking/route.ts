import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const formSchema = z.object({
  trackingId: z.string(),
  userId: z.string(),
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

  const { trackingId } = bodyParsed.data;

  const tracking = await prisma.tracking.findUnique({
    where: {
      id: trackingId,
    },
    select: {
      id: true,
      aiSettings: true,
      globalAiActive: true,
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

  const user = await prisma.user.findUnique({
    where: {
      id: bodyParsed.data.userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return NextResponse.json({
      status: "error",
      message: "User not found",
    });
  }

  return NextResponse.json({
    status: "success",
    tracking,
    user,
  });
}
