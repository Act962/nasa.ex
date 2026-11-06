"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useOrbitaStation() {
  return useQuery({ ...orpc.orbitaStation.getStation.queryOptions(), staleTime: Infinity, refetchOnWindowFocus: false });
}

/** Indicadores das salas (spec 0121, D-2): a cada 30 s, só com a aba visível. Em erro, mantém os últimos dados (CB-4). */
export function useOrbitaRoomIndicators() {
  return useQuery({
    ...orpc.orbitaStation.getRoomIndicators.queryOptions(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export type RoomIndicators = NonNullable<ReturnType<typeof useOrbitaRoomIndicators>["data"]>;
export type WaitingLead = NonNullable<RoomIndicators["chat"]>["leads"][number];

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

/** Itens de decoração da estação (spec 0118). Relidos ao receber o aviso `items` dos colegas (RF-14). */
export function useOrbitaStationItems() {
  return useQuery({ ...orpc.orbitaStation.items.list.queryOptions(), staleTime: Infinity, refetchOnWindowFocus: false });
}

export function usePlaceOrbitaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.orbitaStation.items.place.mutationOptions(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.orbitaStation.items.list.key() }),
  });
}

export function useMoveOrbitaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.orbitaStation.items.move.mutationOptions(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.orbitaStation.items.list.key() }),
  });
}

export function usePickUpOrbitaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.orbitaStation.items.pickUp.mutationOptions(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.orbitaStation.items.list.key() }),
  });
}

/** Relê os itens: depois do aviso de um colega pela sala do LiveKit. */
export function useRefreshOrbitaItems() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.orbitaStation.items.list.key() });
}

export type StationDecorItem = NonNullable<ReturnType<typeof useOrbitaStationItems>["data"]>["items"][number];
