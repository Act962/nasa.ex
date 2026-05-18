"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// `categories.list` no nerp não aceita filtros: o handler GET ignora o body
// e devolve todas categorias top-level com `children` aninhada (1 nível).
export function useNerpCategories() {
  return useQuery(orpc.nerp.categories.list.queryOptions({ input: {} }));
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
