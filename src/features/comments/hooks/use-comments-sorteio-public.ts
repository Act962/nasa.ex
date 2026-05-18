"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useCommentsInstagramMedia() {
  return useQuery(
    orpc.commentsApp.sorteioPublic.listInstagramMedia.queryOptions({
      input: {},
    }),
  );
}

export function useCommentsPublicSorteio(slug: string) {
  return useQuery({
    ...orpc.commentsApp.sorteioPublic.getPublicBySlug.queryOptions({
      input: { slug },
    }),
    enabled: Boolean(slug),
  });
}
