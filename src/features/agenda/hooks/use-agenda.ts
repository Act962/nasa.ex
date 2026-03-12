import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

export const useCreateAgenda = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(orpc.agenda.getMany.queryOptions({}));
      },
    }),
  );
};

export const useSuspenseAgendas = () => {
  return useSuspenseQuery(orpc.agenda.getMany.queryOptions({}));
};

export const useDuplicateAgenda = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.duplicate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(orpc.agenda.getMany.queryOptions({}));
      },
    }),
  );
};

export const useDeleteAgenda = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(orpc.agenda.getMany.queryOptions({}));
      },
    }),
  );
};
