import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo } from "react";

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

interface UseQueryStatusProps {
  trackingId: string;
  enabled?: boolean;
  dateInit?: Date;
  dateEnd?: Date;
  participantFilter?: string;
  tagsFilter?: string[];
  temperatureFilter?: string[];
  actionFilter?: string;
}

export const useQueryStatus = (props: UseQueryStatusProps) => {
  const { data, isLoading } = useQuery(
    orpc.status.getMany.queryOptions({
      input: {
        trackingId: props.trackingId,
        dateInit: props.dateInit?.toISOString(),
        dateEnd: props.dateEnd?.toISOString(),
        participantFilter: props.participantFilter,
        tagsFilter: props.tagsFilter,
        temperatureFilter: props.temperatureFilter,
        actionFilter: props.actionFilter as any,
      },
    }),
  );

  const status = useMemo(() => data ?? EMPTY_LEADS, [data]);

  return {
    status,
    isLoading,
  };
};

import { EMPTY_LEADS, useKanbanStore } from "../lib/kanban-store";

export const useInfiniteLeadsByStatus = ({
  statusId,
  trackingId,
  enabled = true,
  dateInit,
  dateEnd,
  participantFilter,
  tagsFilter,
  temperatureFilter,
  actionFilter,
}: {
  statusId: string;
  trackingId: string;
  enabled?: boolean;
  dateInit?: Date;
  dateEnd?: Date;
  participantFilter?: string;
  tagsFilter?: string[];
  temperatureFilter?: string[];
  actionFilter?: string;
}) => {
  const sortBy = useKanbanStore((state) => state.sortBy);

  const query = orpc.leads.listLeadsByStatus.infiniteOptions({
    input: (
      pageParams: { cursorId?: string; cursorValue?: string } | undefined,
    ) => ({
      statusId,
      trackingId,
      sortBy,
      cursorId: pageParams?.cursorId,
      cursorValue: pageParams?.cursorValue,
      limit: 10,
      dateInit: dateInit?.toISOString(),
      dateEnd: dateEnd?.toISOString(),
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter: actionFilter as any,
    }),
    queryKey: [
      "leads.listLeadsByStatus",
      statusId,
      trackingId,
      sortBy,
      dateInit?.toISOString(),
      dateEnd?.toISOString(),
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
    ],
    context: { cache: true },
    enabled,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.nextCursorId
        ? {
            cursorId: lastPage.nextCursorId,
            cursorValue: lastPage.nextCursorValue,
          }
        : undefined,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(query);

  const leads = useMemo(
    () => data?.pages.flatMap((page) => page.leads) ?? EMPTY_LEADS,
    [data],
  );

  return {
    data: leads,
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

export const useDeleteStatus = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.status.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success("Status deletado com sucesso");
        queryClient.invalidateQueries(
          orpc.status.getMany.queryOptions({
            input: {
              trackingId: data.trackingId,
            },
          }),
        );
      },
      onError: (error) => {
        toast.error(error.message);
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

/// Appointments
export const useQueryAppointmentsByTrackfing = ({
  trackingId,
}: {
  trackingId: string;
}) => {
  const { data, isLoading } = useQuery(
    orpc.agenda.appointments.getManyByTracking.queryOptions({
      input: {
        trackingId,
      },
    }),
  );

  return {
    appointments: data?.appointments ?? [],
    isLoading,
  };
};
