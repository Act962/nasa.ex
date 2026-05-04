import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { LeadSource } from "@/generated/prisma/enums";
import z from "zod";

export const captureLinnkerLead = base
  .route({
    method: "POST",
    path: "/public/linnker/capture",
    summary: "Capture lead data from a Linnker tracking link",
  })
  .input(
    z.object({
      linkId: z.string(),
      pageSlug: z.string(),
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { linkId, pageSlug, name, email, phone } = input;

    const page = await prisma.linnkerPage.findUnique({
      where: { slug: pageSlug },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const link = await prisma.linnkerLink.findFirst({
      where: { id: linkId, pageId: page.id, type: "TRACKING" },
    });
    if (!link) throw errors.NOT_FOUND({ message: "Link não encontrado" });

    // Extract trackingId from URL — stored as ?tracking={id} or /tracking/{id}
    const urlObj = new URL(link.url, "https://placeholder.local");
    const trackingId =
      urlObj.searchParams.get("tracking") ??
      link.url.split("/tracking/")[1]?.split("?")[0];
    if (!trackingId) throw errors.BAD_REQUEST({ message: "Tracking não configurado" });

    const tracking = await prisma.tracking.findUnique({
      where: { id: trackingId },
      include: { status: { orderBy: { order: "asc" }, take: 1 } },
    });
    if (!tracking || !tracking.status[0]) throw errors.NOT_FOUND({ message: "Tracking não encontrado" });

    // Check for existing lead to avoid duplicates
    const existing = phone
      ? await prisma.lead.findFirst({ where: { phone, trackingId } })
      : email
        ? await prisma.lead.findFirst({ where: { email, trackingId } })
        : null;

    let lead = existing;
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name,
          email,
          phone,
          trackingId,
          statusId: tracking.status[0].id,
          source: LeadSource.OTHER,
        },
      });
    }

    // Register scan
    await prisma.linnkerScan.create({
      data: { pageId: page.id, leadId: lead.id, name, email, phone },
    });

    // Increment link click counter
    await prisma.linnkerLink.update({
      where: { id: linkId },
      data: { clicks: { increment: 1 } },
    });

    const owner = await prisma.user.findUnique({
      where: { id: page.userId },
      select: { id: true, name: true, email: true, image: true },
    });
    if (owner) {
      await logActivity({
        organizationId: page.organizationId,
        userId: owner.id,
        userName: owner.name,
        userEmail: owner.email,
        userImage: owner.image,
        appSlug: "linnker",
        subAppSlug: "linnker-leads",
        featureKey: "linnker.lead.captured",
        action: "linnker.lead.captured",
        actionLabel: `Lead "${name}" capturado via Linnker "${page.title}"`,
        resource: name,
        resourceId: lead.id,
        metadata: { pageId: page.id, linkId, isNew: !existing },
      });
    }

    return { message: "Lead capturado com sucesso", leadId: lead.id, redirectUrl: link.url };
  });
