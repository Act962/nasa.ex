import prisma from "@/lib/prisma";

interface leadProps {
  name: string;
  phone: string;
  remoteJid: string;
  trackingId: string;
}

export async function saveLead(body: leadProps) {
  try {
    const status = await prisma.status.findFirst({
      where: {
        trackingId: body.trackingId,
      },
    });

    if (!status) {
      return;
    }

    const lead = await prisma.lead.upsert({
      where: {
        phone_trackingId: {
          phone: body.phone,
          trackingId: body.trackingId,
        },
      },

      create: {
        statusId: status.id,
        name: body.name,
        phone: body.phone,
        trackingId: body.trackingId,
      },
      update: {
        statusId: status.id,
        name: body.name,
        phone: body.phone,
        trackingId: body.trackingId,
      },
    });

    return lead;
  } catch (e) {
    console.log(e);
  }
}
