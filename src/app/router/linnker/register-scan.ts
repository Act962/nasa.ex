import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { LeadSource } from "@/generated/prisma/enums";
import z from "zod";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  trackingParamsSchema,
  trackingToLeadData,
  shouldLogUtmLanding,
} from "@/lib/tracking/tracking-params";

export const registerLinnkerScan = base
  .route({
    method: "POST",
    path: "/public/linnker/:slug/scan",
    summary: "Register a QR code scan and optionally create a lead",
  })
  .input(
    z.object({
      slug: z.string(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      tracking: trackingParamsSchema.optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const { slug, name, email, phone, latitude, longitude, tracking: t } = input;

    const page = await prisma.linnkerPage.findUnique({
      where: { slug, isPublished: true },
    });

    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    let leadId: string | undefined;

    if (name || email || phone) {
      const tracking = await prisma.tracking.findFirst({
        where: { organizationId: page.organizationId },
        orderBy: { createdAt: "asc" },
      });

      if (tracking) {
        const status = await prisma.status.findFirst({
          where: { trackingId: tracking.id },
          orderBy: { order: "asc" },
        });

        if (status) {
          const existingLead = email
            ? await prisma.lead.findFirst({ where: { email, trackingId: tracking.id } })
            : phone
              ? await prisma.lead.findFirst({ where: { phone, trackingId: tracking.id } })
              : null;

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            const lead = await prisma.lead.create({
              data: {
                name: name ?? "Lead via QR Code",
                email,
                phone,
                trackingId: tracking.id,
                statusId: status.id,
                source: LeadSource.OTHER,
                ...trackingToLeadData(t),
              },
            });
            leadId = lead.id;

            if (shouldLogUtmLanding(t)) {
              await trackLeadEvent({
                leadId: lead.id,
                kind: "utm_landing",
                metadata: {
                  utmSource: t?.utmSource,
                  utmCampaign: t?.utmCampaign,
                  landingPage: t?.landingPage,
                  referrer: t?.referrer,
                },
              });
            }
          }
        }
      }
    }

    await prisma.linnkerScan.create({
      data: {
        pageId: page.id,
        leadId,
        name,
        email,
        phone,
        latitude,
        longitude,
      },
    });

    if (leadId) {
      await trackLeadEvent({
        leadId,
        kind: "linnker_scan",
        metadata: { pageId: page.id, slug, hasGeo: !!(latitude && longitude) },
      });
    }

    return { message: "Scan registrado", leadId };
  });
