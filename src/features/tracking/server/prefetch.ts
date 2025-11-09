import { prefetch, trpc } from "@/trpc/server";
import type { inferInput } from "@trpc/tanstack-react-query";

type Input = inferInput<typeof trpc.trackings.getMany>;

export const prefetchTrackings = (params: Input) => {
  return prefetch(trpc.trackings.getMany.queryOptions(params));
};
