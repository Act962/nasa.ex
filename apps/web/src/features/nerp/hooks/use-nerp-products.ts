"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpProducts(input?: {
  search?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "createdAt" | "salePrice" | "currentStock";
  sortDir?: "asc" | "desc";
}) {
  return useQuery(orpc.nerp.products.list.queryOptions({ input: input ?? {} }));
}

export function useNerpProduct(id: string, enabled = true) {
  return useQuery({
    ...orpc.nerp.products.get.queryOptions({ input: { id } }),
    enabled: Boolean(id) && enabled,
  });
}

function useInvalidateProducts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["nerp"] });
}

export function useCreateNerpProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation(
    orpc.nerp.products.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateNerpProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation(
    orpc.nerp.products.update.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDuplicateNerpProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation(
    orpc.nerp.products.duplicate.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteNerpProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation(
    orpc.nerp.products.delete.mutationOptions({ onSuccess: invalidate }),
  );
}
