import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

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
  enabled = true,
  dateInit,
  dateEnd,
  participantFilter,
  tagsFilter,
  temperatureFilter,
}: {
  statusId: string;
  trackingId: string;
  enabled?: boolean;
  dateInit?: Date;
  dateEnd?: Date;
  participantFilter?: string;
  tagsFilter?: string[];
  temperatureFilter?: string[];
}) => {
  const query = orpc.leads.listLeadsByStatus.infiniteOptions({
    input: (pageParams: string | undefined) => ({
      statusId,
      trackingId,
      cursor: pageParams,
      limit: 10,
      dateInit: dateInit?.toISOString(),
      dateEnd: dateEnd?.toISOString(),
      participantFilter,
      tagsFilter,
      temperatureFilter,
    }),
    queryKey: [
      "leads.listLeadsByStatus",
      statusId,
      trackingId,
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
    ],
    context: { cache: true },
    enabled,
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

export const useUpdateColumnOrder = () => {
  return useMutation(
    orpc.status.updateNewOrder.mutationOptions({
      onError: () => {
        toast.error("Erro ao atualizar status");
      },
    }),
  );
};

export const useUpdateLeadOrder = () => {
  return useMutation(
    orpc.leads.updateNewOrder.mutationOptions({
      onError: () => {
        toast.error("Erro ao atualizar lead");
      },
    }),
  );
};
