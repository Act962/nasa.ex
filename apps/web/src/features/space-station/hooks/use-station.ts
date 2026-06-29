"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { WorldAssetType } from "../types";

export function useStationByNick(nick: string) {
  return useQuery(
    orpc.spaceStation.getByNick.queryOptions({ input: { nick } }),
  );
}

export function useMyStation(type: "USER" | "ORG") {
  return useQuery(
    orpc.spaceStation.getMy.queryOptions({ input: { type } }),
  );
}

export function useMyStations() {
  return useQuery(
    orpc.spaceStation.listMy.queryOptions({ input: {} }),
  );
}

export function useListStations(params?: { search?: string; type?: "USER" | "ORG"; page?: number }) {
  return useQuery(
    orpc.spaceStation.list.queryOptions({ input: { page: 1, limit: 20, ...params } }),
  );
}

export function useOrgChart(nick: string) {
  return useQuery(
    orpc.spaceStation.getOrgChart.queryOptions({ input: { nick } }),
  );
}

export function useCreateStation() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.create.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.spaceStation.getMy.queryOptions({ input: { type: "ORG" } })),
  });
}

export function useUpdateStation() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.update.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.spaceStation.getMy.queryOptions({ input: { type: "ORG" } })),
  });
}

export function useSendStar() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.sendStar.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useUpdateWorld() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.updateWorld.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.spaceStation.getMy.queryOptions({ input: { type: "ORG" } })),
  });
}

export function useUpdateModules() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.updateModules.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.spaceStation.getMy.queryOptions({ input: { type: "ORG" } })),
  });
}

export function useWorldAssets(type?: WorldAssetType) {
  return useQuery(
    orpc.spaceStation.listWorldAssets.queryOptions({ input: { type } }),
  );
}

export type WorldTemplateCategory = "OFFICE" | "SPACE" | "NATURE" | "FANTASY" | "TECH" | "OTHER";

export function useListWorldTemplates(params?: { category?: WorldTemplateCategory; search?: string; excludeMine?: boolean }) {
  return useQuery(
    orpc.spaceStation.listWorldTemplates.queryOptions({ input: { ...params } }),
  );
}

export function useListMyWorldTemplates(params?: { category?: WorldTemplateCategory; search?: string }) {
  return useQuery(
    orpc.spaceStation.listMyWorldTemplates.queryOptions({ input: { ...params } }),
  );
}

export function useApplyWorldTemplate() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.applyWorldTemplate.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function usePublishWorldTemplate() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.publishWorldTemplate.mutationOptions(),
    // Invalida todas as queries para garantir que "Meus Salvos" e "Comunidade"
    // reflitam o novo template imediatamente (mesma estratégia de useApplyWorldTemplate).
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteWorldTemplate() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.deleteWorldTemplate.mutationOptions(),
    // Após excluir, revalida "Meus Salvos" e "Comunidade"
    onSuccess: () => qc.invalidateQueries(),
  });
}

/**
 * Busca o mapData completo de um template — usado para aplicação local
 * (extrai só tileLayer + placedObjects sem sobrescrever o mundo inteiro).
 */
export function useGetWorldTemplate() {
  return useMutation(orpc.spaceStation.getWorldTemplate.mutationOptions());
}

export function useListAvatarTemplates(params?: { search?: string }) {
  return useQuery(
    orpc.spaceStation.listAvatarTemplates.queryOptions({ input: { ...params } }),
  );
}

export function usePublishAvatarTemplate() {
  return useMutation(orpc.spaceStation.publishAvatarTemplate.mutationOptions());
}
