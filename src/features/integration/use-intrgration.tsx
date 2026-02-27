import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

export function useIntegration() {
  return useMutation(orpc.integrations.newNasa.mutationOptions());
}
