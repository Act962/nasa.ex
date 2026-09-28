import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/** Chamado de ajuda do Disparo em Massa (spec 0040, RF-9). Toasts ficam no componente. */
export const useRequestTeamHelp = () => {
  return useMutation(orpc.support.createSupportTicket.mutationOptions());
};
