import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const json = await request.json();
  console.log(json);
  const { trackingId, statusId, name, phone, email, description } = json;

  const phoneNormalized = normalizePhone(phone);

  try {
    await prisma.lead.create({
      data: {
        trackingId,
        statusId,
        name,
        phone: phoneNormalized,
        email,
        description,
      },
    });
    return Response.json({ success: true });
  } catch (e) {
    console.log(e);
    return Response.json({ success: false });
  }
}
