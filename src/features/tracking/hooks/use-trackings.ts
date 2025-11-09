import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export const useSuspenseTrackings = () => {
  const trpc = useTRPC();

  return useSuspenseQuery(trpc.trackings.getMany.queryOptions());
};
