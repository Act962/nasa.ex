import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { CalendarShell } from "@/features/public-calendar/components/calendar-shell";
import { CreateEventEntry } from "@/features/public-calendar/components/create-event-entry";
import { ModeToggle } from "@/components/mode-toggle";
import { NasaFooterPublic } from "@/components/nasa-footer-public";

export const metadata: Metadata = {
  title: "Calendário Público · NASA",
  description:
    "Descubra eventos públicos da comunidade NASA — workshops, palestras, lançamentos, hackathons e networking.",
  openGraph: {
    title: "Calendário Público · NASA",
    description:
      "Descubra eventos públicos da comunidade NASA — workshops, palestras, lançamentos, hackathons e networking.",
  },
};

export const revalidate = 60;

export default async function CalendarPage() {
  const now = new Date();
  let initialData: Record<string, unknown> | undefined;
  try {
    const events = await prisma.action.findMany({
      where: {
        isPublic: true,
        isArchived: false,
        isGuestDraft: false,
        publishedAt: { not: null, lte: now },
      },
      orderBy: [{ startDate: "asc" }, { publishedAt: "desc" }],
      take: 60,
      select: {
        id: true,
        publicSlug: true,
        title: true,
        description: true,
        coverImage: true,
        startDate: true,
        endDate: true,
        dueDate: true,
        publishedAt: true,
        eventCategory: true,
        country: true,
        state: true,
        city: true,
        address: true,
        viewCount: true,
        likesCount: true,
        shareCount: true,
        registrationUrl: true,
        organization: { select: { id: true, name: true, logo: true } },
        user: { select: { id: true, name: true, image: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });
    initialData = JSON.parse(
      JSON.stringify({ events, nextCursor: null }),
    ) as Record<string, unknown>;
  } catch {
    // DB unavailable — client will fetch on mount
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="relative border-b border-border/60 px-4 py-4 lg:px-6 lg:py-5">
        <div className="mx-auto max-w-screen-2xl">
          {/* Título centralizado */}
          <div className="text-center">
            <h1 className="text-2xl font-bold lg:text-3xl">
              Calendário Público
            </h1>
            <p className="text-sm text-muted-foreground">
              Crie seus eventos e reuniões e divulgue para a comunidade
            </p>
          </div>
          {/* Ações no canto superior direito (não interferem com a centralização) */}
          <div className="absolute right-4 top-4 flex items-center gap-2 lg:right-6 lg:top-5">
            <ModeToggle />
            <CreateEventEntry />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl flex-1 overflow-hidden">
        <CalendarShell initialData={initialData} />
      </main>

      <NasaFooterPublic />
    </div>
  );
}
