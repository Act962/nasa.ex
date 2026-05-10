import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StationPublicPage } from "@/features/space-station/components/station-public-page";
import type { PublicStation } from "@/features/space-station/types";

interface Props {
  params: Promise<{ nick: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nick } = await params;
  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      bio: true,
      isPublic: true,
      org: { select: { name: true } },
      user: { select: { name: true } },
    },
  });
  if (!station) return { title: "Space Station não encontrada" };
  const name = station.org?.name ?? station.user?.name ?? nick;
  return {
    title: `@${nick} · Space Station`,
    description: station.bio ?? `Visite a Space Station de ${name} no NASA Agents`,
  };
}

export default async function SpaceStationRoute({ params }: Props) {
  const { nick } = await params;

  // Lookup sem filtrar por isPublic — o owner precisa ver a própria
  // estação mesmo enquanto está privada (preview/edição).
  const reqHeaders = await headers();
  const [station, session] = await Promise.all([
    prisma.spaceStation.findUnique({
      where: { nick },
      include: {
        user: { select: { id: true, name: true, image: true, nickname: true } },
        org: { select: { id: true, name: true, slug: true, logo: true } },
        worldConfig: true,
        publicModules: { where: { isActive: true } },
        receivedStars: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, amount: true, message: true, createdAt: true },
        },
      },
    }),
    Promise.race([
      auth.api.getSession({ headers: reqHeaders }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]),
  ]);

  if (!station) notFound();

  const isOwner =
    !!session &&
    (station.userId === session.user.id ||
      station.orgId === session.session.activeOrganizationId);

  // Estação privada só é acessível pelo owner.
  if (!station.isPublic && !isOwner) notFound();

  return (
    <StationPublicPage
      station={{
        ...station,
        receivedStars: station.receivedStars.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
        })),
      } as unknown as PublicStation}
    />
  );
}
