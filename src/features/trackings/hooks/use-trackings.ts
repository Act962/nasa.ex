import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallback, useMemo } from "react";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";
import { Decimal } from "@prisma/client/runtime/client";

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

export const useDeleteTracking = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.tracking.delete.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.list.queryKey(),
        });
        toast.success(
          `${data.trackingName} arquivado por 30 dias antes da exclusão permanente`,
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
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

  const status = useMemo(() => data ?? [], [data]);

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
  statusFlowFilter,
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
  statusFlowFilter?: string[];
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
      statusFlowFilter,
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
      statusFlowFilter,
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
  const queryClient = useQueryClient();

  return useMutation(
    orpc.status.updateNewOrder.mutationOptions({
      onMutate: async ({ id, order }) => {
        await queryClient.cancelQueries({
          queryKey: orpc.status.getMany.key(),
        });

        const snapshots = queryClient.getQueriesData({
          queryKey: orpc.status.getMany.key(),
        });

        queryClient.setQueriesData(
          { queryKey: orpc.status.getMany.key() },
          (old: any) => {
            if (!Array.isArray(old)) return old;
            const next = old.map((c: any) =>
              c.id === id ? { ...c, order } : c,
            );
            return [...next].sort((a: any, b: any) =>
              new Decimal(a.order).comparedTo(new Decimal(b.order)),
            );
          },
        );

        return { snapshots };
      },
      onError: (_err, _vars, ctx) => {
        ctx?.snapshots.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
        toast.error("Erro ao atualizar status");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.status.getMany.key(),
        });
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
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.updateNewOrder.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.status.getMany.queryOptions({
            input: {
              trackingId: data.trackingId,
            },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao atualizar lead");
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });
        // Desfaz o patch otimista do total da coluna (useOptimisticColumnValue):
        // o refetch traz de volta os valores corretos do servidor.
        queryClient.invalidateQueries({ queryKey: orpc.status.getMany.key() });
      },
    }),
  );
};

type StatusColumnRow = {
  id: string;
  _count?: { leads: number };
  valueTotal?: string;
};

export type StatusColumnMeta = { count: number; valueTotal: string };

// Monta o input de `status.getMany` a partir dos filtros da URL (nuqs). Fonte
// única — antes duplicada em cada leaf do header (StatusLeadsCount/Total).
function useStatusGetManyInput(trackingId: string) {
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");
  const [participantFilter] = useQueryState("participant");
  const [tagsFilter] = useQueryState("tags");
  const [temperatureFilter] = useQueryState("temperature");
  const [actionFilter] = useQueryState("filter");

  return useMemo(
    () => ({
      trackingId,
      dateInit: dateInit
        ? dayjs(dateInit).startOf("day").toDate().toISOString()
        : undefined,
      dateEnd: dateEnd
        ? dayjs(dateEnd).endOf("day").toDate().toISOString()
        : undefined,
      participantFilter: participantFilter || undefined,
      tagsFilter: tagsFilter ? tagsFilter.split(",") : undefined,
      temperatureFilter: temperatureFilter
        ? temperatureFilter.split(",")
        : undefined,
      actionFilter: (actionFilter || "ACTIVE") as
        | "ACTIVE"
        | "WON"
        | "LOST"
        | "DELETED",
    }),
    [
      trackingId,
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
    ],
  );
}

/**
 * Meta (contagem + soma de valores) de UMA coluna do board. `select` per-column
 * garante que só o leaf da coluna que mudou re-renderize (sem cascatear pro
 * StatusColumn memoizado). Um único observer por coluna cobre count + total.
 */
export function useStatusColumnMeta(
  trackingId: string,
  columnId: string,
  fallbackCount: number,
) {
  const input = useStatusGetManyInput(trackingId);
  return useQuery({
    ...orpc.status.getMany.queryOptions({ input }),
    select: (columns: StatusColumnRow[]): StatusColumnMeta => {
      const column = columns?.find((status) => status.id === columnId);
      return {
        count: column?._count?.leads ?? fallbackCount,
        valueTotal: column?.valueTotal ?? "0",
      };
    },
  });
}

/**
 * Move otimista do total de valores (`valueTotal`) entre colunas no cache de
 * `status.getMany`, aplicado no drop antes da persistência. Mantém o número
 * do header em sincronia imediata com o card arrastado, sem esperar a
 * invalidação/refetch. `amount` está em centavos (mesma unidade do `valueTotal`).
 */
export const useOptimisticColumnValue = () => {
  const queryClient = useQueryClient();
  return useCallback(
    (sourceColumnId: string, targetColumnId: string, amount: number) => {
      if (sourceColumnId === targetColumnId || !amount) return;
      // Só o cache ATIVO (a view que o usuário está vendo) — que sempre contém
      // o lead arrastado. Variantes filtradas inativas podem não somar esse
      // lead; deixá-las pro refetch evita totais errados em outros filtros.
      queryClient.setQueriesData(
        { queryKey: orpc.status.getMany.key(), type: "active" },
        (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((column: { id: string; valueTotal?: string }) => {
            const currentTotal = Number(column.valueTotal ?? 0);
            if (column.id === sourceColumnId) {
              return {
                ...column,
                valueTotal: Math.max(0, currentTotal - amount).toString(),
              };
            }
            if (column.id === targetColumnId) {
              return {
                ...column,
                valueTotal: (currentTotal + amount).toString(),
              };
            }
            return column;
          });
        },
      );
    },
    [queryClient],
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
