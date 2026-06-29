import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SpaceShell } from "@/features/space-page/components/space-shell";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import {
  resolveLayout,
  type SpaceCardType,
} from "@/features/space-page/utils/template-default";

interface Props {
  params: Promise<{ nick: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nick } = await params;

  // Busca pelo nick da SpaceStation (type=ORG) — identifier compartilhado
  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      type: true,
      org: {
        select: {
          id: true,
          name: true,
          bio: true,
          isSpacehomePublic: true,
          bannerUrl: true,
        },
      },
    },
  });

  if (!station || station.type !== "ORG" || !station.org) {
    return { title: "Spacehome não encontrada" };
  }
  if (!station.org.isSpacehomePublic) {
    // Não vaza informações se for privada
    return { title: "Spacehome privada · NASA" };
  }

  return {
    title: `${station.org.name} · Spacehome`,
    description:
      station.org.bio ??
      `Descubra ${station.org.name} no NASA Agents — projetos, eventos, organograma e mais.`,
    openGraph: {
      title: `${station.org.name} · NASA`,
      description: station.org.bio ?? undefined,
      images: station.org.bannerUrl ? [station.org.bannerUrl] : undefined,
    },
  };
}

export default async function SpacePageRoute({ params }: Props) {
  const { nick } = await params;

  // Busca inicial: station + org + counts (dados críticos pro first paint)
  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      id: true,
      nick: true,
      type: true,
      starsReceived: true,
      org: {
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
        },
      },
    },
  });

  if (!station || station.type !== "ORG" || !station.org) notFound();

  // Se privada, só deixa passar membros logados da org
  const hdrs = await headers();
  const sessionData = await auth.api.getSession({ headers: hdrs });
  const viewerUserId = sessionData?.user?.id ?? null;

  let isMember = false;
  let isAdmin = false;
  if (viewerUserId) {
    const member = await prisma.member.findFirst({
      where: { userId: viewerUserId, organizationId: station.org.id },
      select: { role: true },
    });
    if (member) {
      isMember = true;
      const role = member.role?.toLowerCase();
      isAdmin = role === "owner" || role === "admin";
    }
  }

  if (!station.org.isSpacehomePublic && !isMember) {
    // Não vaza existência
    notFound();
  }

  // Counts em paralelo para o header — todos com timeout de segurança.
  // Neon serverless pode dar cold-start de 5-30s; preferimos renderizar
  // o header com 0 e deixar o client refazer no mount do que travar SSR.
  const COUNTS_TIMEOUT_MS = 1500;
  const withTimeout = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
    Promise.race<T>([
      p.catch(() => fallback),
      new Promise<T>((resolve) =>
        setTimeout(() => resolve(fallback), COUNTS_TIMEOUT_MS),
      ),
    ]);

  const [followers, publishedPosts, approvedReviews, publicActions] =
    await Promise.all([
      withTimeout(
        prisma.orgFollow.count({ where: { orgId: station.org.id } }),
        0,
      ),
      withTimeout(
        prisma.companyPost.count({
          where: { orgId: station.org.id, isPublished: true },
        }),
        0,
      ),
      withTimeout(
        prisma.companyReview.count({
          where: { orgId: station.org.id, status: "APPROVED" },
        }),
        0,
      ),
      withTimeout(
        prisma.action.count({
          where: {
            organizationId: station.org.id,
            isPublic: true,
            isArchived: false,
            publishedAt: { not: null },
          },
        }),
        0,
      ),
    ]);

  // Prefetch SSR paralelo dos cards do template — evita waterfall client-side.
  // Cada card usa o mesmo `useQuery` no client e pega data dehydratada na hora.
  const queryClient = getQueryClient();
  const layout = resolveLayout(station.org.spacehomeTemplate);
  const cardSet = new Set<SpaceCardType>(
    layout.rows.flatMap((r) => r.cards),
  );

  const prefetchTasks: Promise<unknown>[] = [];
  if (cardSet.has("projects")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listProjects.queryOptions({
          input: { nick, limit: 6 },
        }),
      ),
    );
  }
  if (cardSet.has("ranking")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listRanking.queryOptions({
          input: { nick, limit: 5 },
        }),
      ),
    );
  }
  if (cardSet.has("calendar")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listSpaceActions.queryOptions({
          input: { nick, limit: 6 },
        }),
      ),
    );
  }
  if (cardSet.has("nbox")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listPublicNBox.queryOptions({ input: { nick } }),
      ),
    );
  }
  if (cardSet.has("forms")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listForms.queryOptions({ input: { nick } }),
      ),
    );
  }
  if (cardSet.has("news")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listPosts.queryOptions({
          input: { nick, limit: 4 },
        }),
      ),
    );
  }
  if (cardSet.has("reviews")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listReviews.queryOptions({
          input: { nick, limit: 6 },
        }),
      ),
    );
  }
  if (cardSet.has("followers")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listFollowers.queryOptions({
          input: { nick, limit: 20 },
        }),
      ),
    );
  }
  if (cardSet.has("organogram")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.getOrgChart.queryOptions({ input: { nick } }),
      ),
    );
  }
  if (cardSet.has("integrations")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listActiveIntegrations.queryOptions({
          input: { nick },
        }),
      ),
    );
  }
  if (cardSet.has("linnker")) {
    prefetchTasks.push(
      queryClient.prefetchQuery(
        orpc.public.space.listLinnker.queryOptions({ input: { nick } }),
      ),
    );
  }

  // Prefetch é best-effort: se Neon estiver lento (cold-start) ou alguma
  // procedure falhar, seguimos sem bloquear o SSR. As queries que NÃO
  // chegaram a hidratar são refeitas client-side via `useQuery`.
  const PREFETCH_BUDGET_MS = 1500;
  await Promise.race([
    Promise.allSettled(prefetchTasks),
    new Promise<void>((resolve) =>
      setTimeout(resolve, PREFETCH_BUDGET_MS),
    ),
  ]);

  return (
    <HydrateClient client={queryClient}>
      <SpaceShell
        nick={nick}
        initialSpace={{
          org: station.org,
          station: {
            id: station.id,
            nick: station.nick,
            starsReceived: station.starsReceived ?? 0,
          },
          counts: {
            followers,
            publishedPosts,
            approvedReviews,
            publicActions,
          },
          viewer: {
            userId: viewerUserId,
            isMember,
            isAdmin,
          },
        }}
      />
    </HydrateClient>
  );
}
