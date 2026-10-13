"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/** Marca da empresa ativa (Configurações → Marca) e a chave de IA usadas pelo popup do Planner. */

const BRAND_QUERY_KEY = ["brand"];
const MIN_FONT_QUERY_LENGTH = 2;

export function useOrgBrandKit() {
  const { data, isLoading } = useQuery(orpc.brand.getBrandKit.queryOptions({}));
  return { brandKit: data, isLoading };
}

export function useUpdateOrgBrandKit() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.brand.updateBrandKit.mutationOptions({
      onSuccess: () => {
        toast.success("Brand kit atualizado!");
        queryClient.invalidateQueries({ queryKey: BRAND_QUERY_KEY });
      },
      onError: () => toast.error("Erro ao salvar brand kit"),
    }),
  );
}

export function useExtractBrandKitFromLogo() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.brand.extractFromLogo.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Brand kit extraído do logo! Revise os campos abaixo se quiser ajustar.",
        );
        queryClient.invalidateQueries({ queryKey: BRAND_QUERY_KEY });
      },
      onError: (error) =>
        toast.error(error?.message ?? "Erro ao extrair brand kit do logo"),
    }),
  );
}

export function useGoogleFontSuggestions(fontQuery: string) {
  const { data } = useQuery({
    ...orpc.brand.searchGoogleFonts.queryOptions({
      input: { query: fontQuery, limit: 8 },
    }),
    enabled: fontQuery.length >= MIN_FONT_QUERY_LENGTH,
  });
  return { fontSuggestions: data?.fonts ?? [] };
}

export function useSavePlannerAiKey() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.platformIntegrations.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Chave de IA salva!");
        queryClient.invalidateQueries({
          queryKey: orpc.platformIntegrations.getMany.key({}),
        });
        queryClient.invalidateQueries({ queryKey: BRAND_QUERY_KEY });
      },
      onError: (error) =>
        toast.error("Erro ao salvar chave: " + (error?.message ?? "tente novamente")),
    }),
  );
}
