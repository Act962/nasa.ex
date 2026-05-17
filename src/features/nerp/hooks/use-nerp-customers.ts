"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpCustomers(input?: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery(orpc.nerp.customer.list.queryOptions({ input: input ?? {} }));
}

export function useNerpCustomer(id: string, enabled = true) {
  return useQuery({
    ...orpc.nerp.customer.get.queryOptions({ input: { id } }),
    enabled: Boolean(id) && enabled,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["nerp"] });
}

export function useCreateNerpCustomer() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.nerp.customer.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateNerpCustomer() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.nerp.customer.update.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteNerpCustomer() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.nerp.customer.delete.mutationOptions({ onSuccess: invalidate }),
  );
}
