import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

export function useMutationExport() {
  return useMutation(
    orpc.leads.exportLeads.mutationOptions(),
  );
}
