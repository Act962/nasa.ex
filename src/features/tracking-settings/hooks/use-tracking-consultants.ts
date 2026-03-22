import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useQueryTrackingConsultants = (trackingId: string) => {
  const { data, isLoading } = useQuery(
    orpc.rodizio.list.queryOptions({ input: { trackingId } }),
  );

  return {
    trackingConsultants: data?.consultants || [],
    isLoadingTrackingConsultants: isLoading,
  };
};

export const useQueryUsersWithoutConsultants = (trackingId: string) => {
  const { data, isLoading } = useQuery(
    orpc.rodizio.listUsersWithoutConsultants.queryOptions({
      input: { trackingId },
    }),
  );

  return {
    usersWithoutConsultants: data?.usersWithoutConsultant || [],
    isLoadingUsersWithoutConsultants: isLoading,
  };
};

export const useCreateTrackingConsultant = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.rodizio.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Consultor adicionado ao rod�zio com sucesso.");

        queryClient.invalidateQueries(
          orpc.rodizio.list.queryOptions({
            input: { trackingId: data.trackingId },
          }),
        );
      },
      onError: (error: any) => {
        toast.error(error?.message ?? "Erro ao criar consultor do rod�zio.");
      },
    }),
  );
};

export const useUpdateTrackingConsultant = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.rodizio.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.rodizio.list.queryOptions({
            input: { trackingId: data.trackingId },
          }),
        );
      },
    }),
  );
};

export const useDeleteTrackingConsultant = (trackingId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.rodizio.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.rodizio.list.queryOptions({ input: { trackingId } }),
        );
      },
    }),
  );
};
