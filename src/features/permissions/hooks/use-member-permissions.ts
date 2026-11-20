"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useSetMemberPermissions() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.permissions.setMemberPermissions.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: orpc.permissions.getPermissions.key() }),
  });
}
