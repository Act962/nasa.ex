"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useFingerprint } from "./use-fingerprint";
import { toast } from "sonner";

export function useToggleLike(slug: string) {
  const qc = useQueryClient();
  const { fingerprint } = useFingerprint();

  return useMutation({
    ...orpc.public.calendar.toggleLike.mutationOptions(),
    onMutate: () => {
      if (!fingerprint) {
        toast.error("Aguarde um instante…");
        throw new Error("no_fingerprint");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: orpc.public.calendar.getPublicEvent.queryKey({
          input: { slug },
        }),
      });
    },
    onError: (err) => {
      if ((err as Error).message !== "no_fingerprint") {
        toast.error("Não foi possível curtir");
      }
    },
  });
}
