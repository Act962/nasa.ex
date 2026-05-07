import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { AvatarConfig, StationWorldConfig } from "@/features/space-station/types";
import { SpaceGameLoader } from "@/features/space-station/components/world/space-game-loader";

interface Props {
  params: Promise<{ nick: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nick } = await params;
  return {
    title: `@${nick} · Mundo Virtual | NASA Agents`,
    description: `Entre no mundo virtual de @${nick}`,
  };
}

export default async function SpaceStationWorldRoute({ params }: Props) {
  const { nick } = await params;

  const reqHeaders = await headers();

  const [station, session] = await Promise.all([
    prisma.spaceStation.findUnique({
      where: { nick, isPublic: true },
      select: { id: true, nick: true, worldConfig: true, userId: true, orgId: true },
    }),
    Promise.race([
      auth.api.getSession({ headers: reqHeaders }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]),
  ]);

  if (!station) notFound();

  const isOwner = !!session && (
    station.userId === session.user.id ||
    station.orgId === session.session.activeOrganizationId
  );

  // Dados do usuário para o avatar e WebRTC
  const userImage = session?.user?.image ?? null;
  const userId    = session?.user?.id    ?? `guest_${station.id.slice(0, 8)}`;
  const userName  = session?.user?.name  ?? nick;

  const defaultWorldConfig: StationWorldConfig = {
    id: "",
    stationId: station.id,
    planetColor: "#4B0082",
    ambientTheme: "space",
    avatarConfig: null,
    meetingPoints: null,
    npcConfig: null,
    mapData: null,
  };

  const worldConfig = (station.worldConfig ?? defaultWorldConfig) as unknown as StationWorldConfig;
  const avatarConfig = worldConfig.avatarConfig as AvatarConfig | undefined;

  return (
    <SpaceGameLoader
      worldConfig={worldConfig}
      avatarConfig={avatarConfig}
      stationId={station.id}
      nick={station.nick}
      isOwner={isOwner}
      userImage={userImage}
      userId={userId}
      userName={userName}
    />
  );
}
