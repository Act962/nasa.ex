"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type PriceCategory =
  | "AI_MODEL"
  | "WHATSAPP_CONVERSATION"
  | "INFRA_SERVER"
  | "HOSTING"
  | "STORAGE"
  | "DATABASE"
  | "LABOR"
  | "OTHER";

export function useForgePriceItems(filters?: {
  category?: PriceCategory;
  search?: string;
  activeOnly?: boolean;
}) {
  return useQuery(
    orpc.forge.priceCatalog.listItems.queryOptions({ input: filters ?? {} }),
  );
}

function useInvalidatePriceCatalog() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: orpc.forge.priceCatalog.listItems.key() });
}

export function useCreateForgePriceItem() {
  const invalidate = useInvalidatePriceCatalog();
  return useMutation({
    ...orpc.forge.priceCatalog.createItem.mutationOptions(),
    onSuccess: invalidate,
  });
}

export function useUpdateForgePriceItem() {
  const invalidate = useInvalidatePriceCatalog();
  return useMutation({
    ...orpc.forge.priceCatalog.updateItem.mutationOptions(),
    onSuccess: invalidate,
  });
}

export function useDeleteForgePriceItem() {
  const invalidate = useInvalidatePriceCatalog();
  return useMutation({
    ...orpc.forge.priceCatalog.deleteItem.mutationOptions(),
    onSuccess: invalidate,
  });
}

export function useForgePriceSuggestions(status?: "PENDING" | "APPROVED" | "REJECTED") {
  return useQuery(
    orpc.forge.priceCatalog.listSuggestions.queryOptions({ input: { status } }),
  );
}

export function useReviewForgePriceSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.priceCatalog.reviewSuggestion.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.forge.priceCatalog.listSuggestions.key() });
      qc.invalidateQueries({ queryKey: orpc.forge.priceCatalog.listItems.key() });
    },
  });
}
