import prisma from "@/lib/prisma";
import { buildIcs } from "@/features/public-calendar/utils/ics";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const event = await prisma.action.findFirst({
    where: { publicSlug: slug, isPublic: true, isArchived: false },
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      endDate: true,
      address: true,
      city: true,
      state: true,
      publicSlug: true,
    },
  });

  if (!event || !event.startDate) {
    return new Response("Event not found", { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const location = [event.address, event.city, event.state]
    .filter(Boolean)
    .join(", ");

  const ics = buildIcs({
    uid: event.id,
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    location: location || null,
    url: appUrl ? `${appUrl}/calendario/evento/${event.publicSlug}` : null,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
    },
  });
}
