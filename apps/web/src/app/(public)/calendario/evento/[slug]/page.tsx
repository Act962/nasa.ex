import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cache } from "react";
import prisma from "@/lib/prisma";
import { EventClient } from "./event-client";

interface Params {
  slug: string;
}

const getFullEvent = cache(async (slug: string) => {
  return prisma.action.findFirst({
    where: {
      publicSlug: slug,
      isPublic: true,
      isGuestDraft: false,
      publishedAt: { not: null },
    },
    include: {
      organization: { select: { id: true, name: true, logo: true } },
      user: { select: { id: true, name: true, image: true } },
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      tags: {
        include: { tag: { select: { id: true, name: true, color: true } } },
      },
    },
  });
});

export async function generateStaticParams() {
  const events = await prisma.action.findMany({
    where: { isPublic: true, isGuestDraft: false, isArchived: false },
    select: { publicSlug: true },
  });
  return events
    .filter((e) => !!e.publicSlug)
    .map((e) => ({ slug: e.publicSlug as string }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getFullEvent(slug);

  if (!event) return { title: "Evento não encontrado" };

  const description = event.description
    ? event.description.slice(0, 160)
    : "Evento público da comunidade NASA.";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const ogImage = event.coverImage
    ? event.coverImage.startsWith("http") || event.coverImage.startsWith("/")
      ? event.coverImage
      : `${appUrl}/uploads/${event.coverImage}`
    : `${appUrl}/calendario/evento/${slug}/opengraph-image`;

  return {
    title: `${event.title} · NASA`,
    description,
    openGraph: {
      title: event.title,
      description,
      images: [ogImage],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [ogImage],
    },
  };
}

export const revalidate = 300;

export default async function EventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  let event: Awaited<ReturnType<typeof getFullEvent>> = null;
  try {
    event = await getFullEvent(slug);
  } catch {
    // DB unavailable — fall through to notFound or client fetch
  }

  if (!event || !event.publicSlug) notFound();

  let initialData: Record<string, unknown> | undefined;
  try {
    const related = await prisma.action.findMany({
      where: {
        isPublic: true,
        isArchived: false,
        isGuestDraft: false,
        publishedAt: { not: null },
        id: { not: event.id },
        ...(event.eventCategory ? { eventCategory: event.eventCategory } : {}),
      },
      orderBy: { startDate: "asc" },
      take: 4,
      select: {
        id: true,
        publicSlug: true,
        title: true,
        coverImage: true,
        startDate: true,
        city: true,
        state: true,
        eventCategory: true,
      },
    });
    // JSON round-trip converts Decimal → number and Date → string
    initialData = JSON.parse(
      JSON.stringify({ event, isLikedByMe: false, related }),
    ) as Record<string, unknown>;
  } catch {
    // related failed — still render with event data only
    initialData = JSON.parse(
      JSON.stringify({ event, isLikedByMe: false, related: [] }),
    ) as Record<string, unknown>;
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl p-6 text-center text-sm text-muted-foreground">
          Carregando evento…
        </div>
      }
    >
      <EventClient slug={event.publicSlug} initialData={initialData} />
    </Suspense>
  );
}
