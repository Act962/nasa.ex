import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { NextRequest } from "next/server";
import z from "zod";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { extractTracking } from "@/lib/tracking/extract-tracking.server";
import { getPostHogClient } from "@/lib/posthog-server";

const optionalText = (maxLength: number) => z.string().max(maxLength).optional();

const externalLeadSchema = z.object({
  trackingId: z.string().min(1).max(64),
  statusId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  phone: z.union([z.string().max(40), z.number()]).transform(String).optional(),
  email: optionalText(254),
  description: optionalText(5000),
  utm_source: optionalText(500),
  utm_medium: optionalText(500),
  utm_campaign: optionalText(500),
  utm_content: optionalText(500),
  utm_term: optionalText(500),
  referrer: optionalText(2000),
  landingPage: optionalText(2000),
  device: optionalText(100),
});

/** Quem chama a porta (spec 0112, RF-4): serve para mapear os sites antes de exigir chave. */
function readCallerOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

const rejectPayload = (error: string) => Response.json({ success: false, error }, { status: 400 });

export async function POST(request: NextRequest) {
  const parsedPayload = externalLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedPayload.success) return rejectPayload("Dados do lead inválidos");

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
  } = parsedPayload.data;

  const targetStatus = await prisma.status.findFirst({
    where: { id: statusId, trackingId },
    select: { tracking: { select: { name: true, organizationId: true } } },
  });
  if (!targetStatus) return rejectPayload("A coluna não pertence ao tracking");

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

    const targetTracking = targetStatus.tracking;
    await logActivity({
      organizationId: targetTracking.organizationId,
      userId: "system",
      userName: "Sistema",
      userEmail: "sistema@nasa",
      appSlug: "tracking",
      action: "lead.arrived",
      actionLabel: `Um lead chegou no tracking "${targetTracking.name}" via formulário (${name})`,
      resource: name,
      resourceId: lead.id,
      metadata: {
        phone: phoneNormalized,
        email,
        trackingName: targetTracking.name,
        source: "FORM",
        callerOrigin: readCallerOrigin(request),
        callerUserAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      },
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: email ?? phoneNormalized ?? lead.id,
      event: "lead_created",
      properties: {
        lead_id: lead.id,
        tracking_id: trackingId,
        utm_source: tracking.utmSource,
        utm_medium: tracking.utmMedium,
        utm_campaign: tracking.utmCampaign,
        device: tracking.device,
        source: "external_form",
      },
    });
    await posthog.shutdown();

    return Response.json({ success: true });
  } catch (e) {
    console.log(e);
    return Response.json({ success: false });
  }
}
