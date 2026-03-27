import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const json = await request.json();
  console.log(json);
  const { trackingId } = json;
  try {
    const consultants = await prisma.trackingConsultant.findMany({
      where: {
        trackingId,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    return Response.json({ consultants });
  } catch (e) {
    console.log(e);
    return Response.json({ success: false });
  }
}
