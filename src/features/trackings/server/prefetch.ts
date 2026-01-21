import { prefetch, trpc } from "@/trpc/server";
import { inferInput } from "@trpc/tanstack-react-query";

type Input = inferInput<typeof trpc.trackings.getMany>;

export function prefetchTrackings(input: Input) {
  return prefetch(trpc.trackings.getMany.queryOptions(input));
}
