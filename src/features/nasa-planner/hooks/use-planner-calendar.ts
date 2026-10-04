"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";

/** Leituras do calendário multi-cliente do Planner v2 (spec 0058). */

const PUBLISHING_POLL_MS = 3000;

export interface CalendarRange {
  organizationIds?: string[];
  from: Date;
  to: Date;
}

export function usePlannerClients() {
  const { data, isLoading } = useQuery(orpc.nasaPlanner.clients.list.queryOptions());
  return { clients: data?.clients ?? [], isLoading };
}

export function usePlannerCalendarPosts(range: CalendarRange & { types?: NasaPlannerPostType[]; statuses?: NasaPlannerPostStatus[] }) {
  const query = useQuery({
    ...orpc.nasaPlanner.calendar.posts.queryOptions({ input: range }),
    // Enquanto algum post está publicando, a tela acompanha o status sozinha.
    refetchInterval: (currentQuery) =>
      currentQuery.state.data?.posts.some((post) => post.status === "PUBLISHING" || post.status === "SCHEDULED" && post.scheduledAt && new Date(post.scheduledAt).getTime() < Date.now())
        ? PUBLISHING_POLL_MS
        : false,
  });
  return { posts: query.data?.posts ?? [], isLoading: query.isLoading };
}

export function usePlannerDrafts(input: { organizationIds?: string[]; queue: "drafts" | "approval" }) {
  const query = useInfiniteQuery(
    orpc.nasaPlanner.calendar.drafts.infiniteOptions({
      input: (cursor: string | undefined) => ({ ...input, cursor }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }),
  );
  return {
    posts: query.data?.pages.flatMap((page) => page.posts) ?? [],
    isLoading: query.isLoading,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage(),
  };
}

export function usePlannerSlots(range: CalendarRange) {
  const { data } = useQuery(orpc.nasaPlanner.calendar.slots.queryOptions({ input: range }));
  return { slots: data?.slots ?? [], source: data?.source ?? "DEFAULT" };
}

export function usePlannerMoments(range: CalendarRange) {
  const { data, isLoading } = useQuery(orpc.nasaPlanner.calendar.moments.queryOptions({ input: range }));
  return { moments: data?.moments ?? [], campaignEvents: data?.campaignEvents ?? [], isLoading };
}

export function usePlannerPost(postId: string | null) {
  const { data, isLoading } = useQuery({
    ...orpc.nasaPlanner.posts.getOne.queryOptions({ input: { postId: postId ?? "" } }),
    enabled: Boolean(postId),
    // Post aberto na hora de publicar: acompanha até virar Publicado ou Falhou.
    refetchInterval: (currentQuery) => {
      const post = currentQuery.state.data?.post;
      const isDue = post?.status === "SCHEDULED" && post.scheduledAt && new Date(post.scheduledAt).getTime() <= Date.now();
      return post?.status === "PUBLISHING" || isDue ? PUBLISHING_POLL_MS : false;
    },
  });
  return { post: data?.post ?? null, permissions: data?.permissions ?? null, isLoading };
}
