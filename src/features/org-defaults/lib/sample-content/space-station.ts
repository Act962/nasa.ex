import "server-only";
import prisma from "@/lib/prisma";
import { shortRandomSuffix, toUrlSlug } from "./helpers";
import type { SampleSeedContext } from "./types";

const NICK_MAX_LENGTH = 30;
const NICK_SUFFIX_LENGTH = 7;

function buildStationNick(organizationSlug: string): string {
  const nickBase = (toUrlSlug(organizationSlug) || "empresa").slice(0, NICK_MAX_LENGTH - NICK_SUFFIX_LENGTH);
  return `${nickBase}-${shortRandomSuffix()}`;
}

export async function seedSampleSpaceStation(context: SampleSeedContext): Promise<void> {
  const existingStation = await prisma.spaceStation.findUnique({
    where: { orgId: context.organizationId },
    select: { id: true },
  });
  if (existingStation) return;

  await prisma.spaceStation.create({
    data: {
      type: "ORG",
      nick: buildStationNick(context.organizationSlug),
      bio: "Bem-vindo à nossa Space Station! (exemplo) Edite esta apresentação quando quiser.",
      rank: "CREW",
      isPublic: false,
      orgId: context.organizationId,
      userId: null,
    },
  });
}
