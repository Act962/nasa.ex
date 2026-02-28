import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

export function useIntegrationTotal() {
  return useMutation(orpc.integrations.newNasa.mutationOptions());
}

export function useIntegrationPartial() {
  return useMutation(orpc.integrations.newNasaPartial.mutationOptions());
}
