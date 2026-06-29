import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AgendaClient, type AgendaEvent } from "./agenda-client";

interface Props {
  params: Promise<{ nick: string }>;
}

const EVENTS_LIMIT = 100;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nick } = await params;
  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      type: true,
      org: { select: { name: true, isSpacehomePublic: true } },
    },
  });
  if (!station || station.type !== "ORG" || !station.org) {
    return { title: "Agenda não encontrada" };
  }
  if (!station.org.isSpacehomePublic) {
    return { title: "Agenda privada" };
  }
  return {
    title: `Agenda · ${station.org.name}`,
    description: `Próximos eventos públicos de ${station.org.name}.`,
  };
}

export default async function SpaceAgendaPage({ params }: Props) {
  const { nick } = await params;

  const hdrs = await headers();

  const [station, sessionData] = await Promise.all([
    prisma.spaceStation.findUnique({
      where: { nick },
      select: {
        type: true,
        org: {
          select: {
            id: true,
            name: true,
            logo: true,
            isSpacehomePublic: true,
          },
        },
      },
    }),
    auth.api.getSession({ headers: hdrs }),
  ]);

  if (!station || station.type !== "ORG" || !station.org) notFound();

  const viewerUserId = sessionData?.user?.id ?? null;
  const orgId = station.org.id;

  const [memberRow, eventRows] = await Promise.all([
    !station.org.isSpacehomePublic && viewerUserId
      ? prisma.member.findFirst({
          where: { userId: viewerUserId, organizationId: orgId },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.action.findMany({
      where: {
        organizationId: orgId,
        isPublic: true,
        isArchived: false,
        isGuestDraft: false,
        publishedAt: { not: null },
      },
      orderBy: [{ startDate: "asc" }, { publishedAt: "desc" }],
      take: EVENTS_LIMIT,
      select: {
        id: true,
        publicSlug: true,
        title: true,
        description: true,
        coverImage: true,
        startDate: true,
        endDate: true,
        publishedAt: true,
        eventCategory: true,
        city: true,
        state: true,
        address: true,
        viewCount: true,
        likesCount: true,
        registrationUrl: true,
      },
    }),
  ]);

  if (!station.org.isSpacehomePublic && !memberRow) notFound();

  const initialEvents: AgendaEvent[] = eventRows.map((ev) => ({
    ...ev,
    startDate: ev.startDate?.toISOString() ?? null,
    endDate: ev.endDate?.toISOString() ?? null,
    publishedAt: ev.publishedAt?.toISOString() ?? null,
  }));

  return (
    <AgendaClient
      nick={nick}
      org={{
        id: orgId,
        name: station.org.name,
        logo: station.org.logo,
      }}
      initialEvents={initialEvents}
    />
  );
}
