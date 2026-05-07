import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { NextRequest } from "next/server";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { extractTracking } from "@/lib/tracking/extract-tracking.server";

export async function POST(request: NextRequest) {
  const json = await request.json();
  console.log(json);
  const {
    trackingId,
    statusId,
    name,
    phone,
    email,
    description,
    // UTMs/origem podem vir explicitamente no body (caller externo)
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    referrer,
    landingPage,
    device,
  } = json;

  const phoneNormalized = normalizePhone(phone);

  const tracking = extractTracking({
    cookies: request.cookies,
    headers: request.headers,
    explicit: {
      utmSource: utm_source,
      utmMedium: utm_medium,
      utmCampaign: utm_campaign,
      utmContent: utm_content,
      utmTerm: utm_term,
      referrer,
      landingPage,
      device,
    },
  });

  try {
    const lead = await prisma.lead.create({
      data: {
        trackingId,
        statusId,
        name,
        phone: phoneNormalized,
        email,
        description,
        utmSource: tracking.utmSource,
        utmMedium: tracking.utmMedium,
        utmCampaign: tracking.utmCampaign,
        utmContent: tracking.utmContent,
        utmTerm: tracking.utmTerm,
        referrer: tracking.referrer,
        landingPage: tracking.landingPage,
        device: tracking.device,
      },
    });

    if (tracking.utmSource || tracking.utmCampaign) {
      await trackLeadEvent({
        leadId: lead.id,
        kind: "utm_landing",
        metadata: {
          utmSource: tracking.utmSource,
          utmCampaign: tracking.utmCampaign,
          landingPage: tracking.landingPage,
        },
      });
    }

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
