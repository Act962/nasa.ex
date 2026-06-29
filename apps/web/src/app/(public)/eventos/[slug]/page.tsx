import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventPublicPage } from "@/features/world-events/components/event-public-page";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Página pública de um WorldEvent (server-rendered, SEO-friendly).
 *
 * Mostra capa, descrição, datas, capacidade, preço e CTA de compra.
 * O fluxo de compra (purchaseTicket) é tratado no componente client.
 */
export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;

  const event = await prisma.worldEvent.findUnique({
    where: { slug },
    include: {
      station: {
        select: { nick: true, bio: true, avatarUrl: true, bannerUrl: true },
      },
    },
  });
  if (!event || !event.isPublic) return notFound();

  return (
    <EventPublicPage
      event={{
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        coverUrl: event.coverUrl,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        capacity: event.capacity,
        currentOccupancy: event.currentOccupancy,
        ticketPriceStars: event.ticketPriceStars,
        ticketPriceBrl: event.ticketPriceBrl
          ? Number(event.ticketPriceBrl)
          : null,
        isFree: event.isFree,
        status: event.status,
        stationNick: event.station?.nick ?? null,
        stationBio: event.station?.bio ?? null,
        stationAvatarUrl: event.station?.avatarUrl ?? null,
        stationBannerUrl: event.station?.bannerUrl ?? null,
      }}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const event = await prisma.worldEvent.findUnique({
    where: { slug },
    select: { title: true, description: true, coverUrl: true, isPublic: true },
  });
  if (!event || !event.isPublic) return { title: "Evento não encontrado" };
  return {
    title: `${event.title} · NASA World`,
    description: event.description ?? "Evento no NASA World",
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      images: event.coverUrl ? [event.coverUrl] : undefined,
    },
  };
}
