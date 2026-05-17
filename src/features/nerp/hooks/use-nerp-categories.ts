"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpCategories(input?: {
  search?: string;
  parentId?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery(orpc.nerp.categories.list.queryOptions({ input: input ?? {} }));
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["nerp"] });
}

export function useCreateNerpCategory() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.nerp.categories.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateNerpCategory() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.nerp.categories.update.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteNerpCategory() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.nerp.categories.delete.mutationOptions({ onSuccess: invalidate }),
  );
}
