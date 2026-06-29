"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useFingerprint } from "./use-fingerprint";

export function usePublicEvent(
  slug: string,
  sharerToken?: string | null,
  initialData?: Record<string, unknown>,
) {
  const qc = useQueryClient();
  const { fingerprint, ready } = useFingerprint();

  const query = useQuery({
    ...orpc.public.calendar.getPublicEvent.queryOptions({ input: { slug } }),
    enabled: !!slug && !initialData,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData: initialData as any,
  });

  const recordView = useMutation({
    ...orpc.public.calendar.recordView.mutationOptions(),
    onSuccess: (res) => {
      // Só invalida quando a view foi NOVA — evita refetch redundante
      // quando o mesmo fingerprint volta no mesmo evento.
      if (res?.wasNew) {
        qc.invalidateQueries({
          queryKey: orpc.public.calendar.getPublicEvent.queryKey({
            input: { slug },
          }),
        });
      }
    },
  });

  useEffect(() => {
    if (!ready || !fingerprint || !slug) return;
    recordView.mutate({
      slug,
      fingerprint,
      sharerToken: sharerToken || undefined,
    });
  }, [ready, fingerprint, slug, sharerToken]);

  return query;
}
