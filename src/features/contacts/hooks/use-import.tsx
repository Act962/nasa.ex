import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

export function useMutationImport() {
  return useMutation(orpc.leads.importLead.mutationOptions({}));
}
