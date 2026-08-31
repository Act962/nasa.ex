import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import type { TrafegoPlatform } from "@/generated/prisma/enums";

/** Catálogo público — usado pelo wizard em `/trafego`, sem autenticação. */
export const usePublicTrafegoPlans = (platform?: TrafegoPlatform) => {
  return useQuery(
    orpc.trafego.listPublicPlans.queryOptions({
      input: platform ? { platform } : {},
    }),
  );
};
