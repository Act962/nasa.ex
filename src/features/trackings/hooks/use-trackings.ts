import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";

export const useQueryTrackings = () => {
  const { data, isLoading } = useQuery(orpc.tracking.list.queryOptions());

  return {
    trackings: data ?? [],
    isLoading,
  };
};

export const useSuspenseTrackings = () => {
  return useSuspenseQuery(orpc.tracking.list.queryOptions());
};

export const useSuspenseParticipants = ({
  trackingId,
}: {
  trackingId: string;
}) => {
  return useSuspenseQuery(
    orpc.tracking.listParticipants.queryOptions({ input: { trackingId } }),
  );
};

export const useQueryParticipants = ({
  trackingId,
}: {
  trackingId: string;
}) => {
  const { data, isLoading } = useQuery(
    orpc.tracking.listParticipants.queryOptions({ input: { trackingId } }),
  );

  return {
    participants: data?.participants ?? [],
    isLoading,
  };
};

export const useQueryStatus = ({ trackingId }: { trackingId: string }) => {
  const { data, isLoading } = useQuery(
    orpc.status.getMany.queryOptions({
      input: {
        trackingId,
      },
    }),
  );

  return {
    status: data ?? [],
    isLoading,
  };
};

export const useInfiniteLeadsByStatus = ({
  statusId,
  trackingId,
}: {
  statusId: string;
  trackingId: string;
}) => {
  const query = orpc.leads.listLeadsByStatus.infiniteOptions({
    input: (pageParams: string | undefined) => ({
      statusId,
      trackingId,
      cursor: pageParams,
      limit: 50,
    }),
    context: { cache: true },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(query);

  return {
    data: data?.pages.flatMap((page) => page.leads) ?? [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  };
};
