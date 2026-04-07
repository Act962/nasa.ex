import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const json = await request.json();
  console.log(json);
  const { trackingId, statusId, name, phone, email, description } = json;

  const phoneNormalized = normalizePhone(phone);

  try {
    const lead = await prisma.lead.create({
      data: {
        trackingId,
        statusId,
        name,
        phone: phoneNormalized,
        email,
        description,
      },
    });

    try {
      const tracking = await prisma.tracking.findUnique({
        where: { id: trackingId },
        select: { name: true, organizationId: true },
      });
      if (tracking) {
        await logActivity({
          organizationId: tracking.organizationId,
          userId: "system",
          userName: "Sistema",
          userEmail: "sistema@nasa",
          appSlug: "tracking",
          action: "lead.arrived",
          actionLabel: `Um lead chegou no tracking "${tracking.name}" via formulário (${name ?? phone})`,
          resource: name ?? phone,
          resourceId: lead.id,
          metadata: { phone: phoneNormalized, email, trackingName: tracking.name, source: "FORM" },
        });
      }
    } catch {}

    return Response.json({ success: true });
  } catch (e) {
    console.log(e);
    return Response.json({ success: false });
  }
}
