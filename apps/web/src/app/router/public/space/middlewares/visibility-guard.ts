import { cache } from "react";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { base } from "@/app/middlewares/base";

/**
 * Middleware central de visibilidade da Spacehome.
 *
 * Resolve o `nick` recebido via input e faz as checagens:
 *  1. Existe uma SpaceStation do tipo ORG com esse nick?
 *  2. `Organization.isSpacehomePublic` = true? Se não, só membros logados
 *     da org podem consumir. Visitantes recebem NOT_FOUND para NUNCA
 *     vazar que a page existe.
 *
 * Ao final injeta no context: `{ orgId, organization, station, isMember }`.
 *
 * As 4 buscas (station/org/session/member) são memoizadas por request
 * via `React.cache`. A spacehome prefetch ~11 procedures por SSR e cada
 * uma chamava esse guard de novo — daria 44+ queries Neon em série.
 * Com cache cai pra 4 queries por request, compartilhadas entre cards.
 */

const findStationByNick = cache(async (nick: string) =>
  prisma.spaceStation.findFirst({
    where: { nick, type: "ORG" },
    select: {
      id: true,
      nick: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      theme: true,
      starsReceived: true,
      accessMode: true,
      orgId: true,
    },
  }),
);

const findOrganizationById = cache(async (orgId: string) =>
  prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      bio: true,
      bannerUrl: true,
      website: true,
      isSpacehomePublic: true,
      spacehomeTemplate: true,
      nasaPageId: true,
      city: true,
      state: true,
      country: true,
    },
  }),
);

const getSessionFromHeaders = cache(async (headers: Headers) =>
  auth.api.getSession({ headers }),
);

const findMembership = cache(async (userId: string, organizationId: string) =>
  prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true, role: true },
  }),
);

export const spaceVisibilityGuard = base.middleware(
  async ({ context, next, errors }, input: unknown) => {
    const nick =
      typeof input === "object" && input !== null && "nick" in input
        ? String((input as { nick: string }).nick).trim()
        : "";

    if (!nick) {
      throw errors.BAD_REQUEST({ message: "Nick obrigatório." });
    }

    const station = await findStationByNick(nick);

    if (!station?.orgId) {
      // Não expor diferença entre "não existe" e "é privada".
      throw errors.NOT_FOUND({ message: "Spacehome não encontrada." });
    }

    const organization = await findOrganizationById(station.orgId);

    if (!organization) {
      throw errors.NOT_FOUND({ message: "Spacehome não encontrada." });
    }

    // Session é opcional — existe pra poder liberar membros em pages privadas
    const sessionData = await getSessionFromHeaders(context.headers);
    const userId = sessionData?.user?.id ?? null;

    let isMember = false;
    if (userId) {
      const member = await findMembership(userId, organization.id);
      isMember = !!member;
    }

    if (!organization.isSpacehomePublic && !isMember) {
      // Página privada + visitante não-membro: mentira branca — 404.
      throw errors.NOT_FOUND({ message: "Spacehome não encontrada." });
    }

    return next({
      context: {
        orgId: organization.id,
        organization,
        station,
        isMember,
        viewerId: userId,
      },
    });
  },
);
