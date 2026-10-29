"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useOrbitaStation() {
  return useQuery({ ...orpc.orbitaStation.getStation.queryOptions(), staleTime: Infinity, refetchOnWindowFocus: false });
}

export function useUpdateOrbitaStation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.orbitaStation.updateStation.mutationOptions(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.orbitaStation.getStation.key() }),
  });
}

/** Token da sala de tempo real. Pedido sob demanda (na conexão e em cada reconexão), sem cache. */
export function useFetchOrbitaJoinToken() {
  const queryClient = useQueryClient();
  return () => queryClient.fetchQuery({ ...orpc.orbitaStation.getJoinToken.queryOptions(), staleTime: 0 });
}

export function useSaveOrbitaAvatar() {
  return useMutation(orpc.orbitaStation.avatar.save.mutationOptions());
}
