import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

export const useSuspenseAgendas = () => {
  return useSuspenseQuery(orpc.agenda.getMany.queryOptions({}));
};

export const useSuspenseAgenda = (agendaId: string) => {
  return useSuspenseQuery(
    orpc.agenda.get.queryOptions({ input: { agendaId } }),
  );
};

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

export const useToggleActiveAgenda = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.toggleActive.mutationOptions({
      onSuccess: (data) => {
        toast.success("Agenda atualizada com sucesso");
        queryClient.invalidateQueries(orpc.agenda.getMany.queryOptions({}));
        queryClient.invalidateQueries(
          orpc.agenda.get.queryOptions({ input: { agendaId: data.agenda.id } }),
        );
      },
    }),
  );
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

// Availabilities

export const useSuspenseAvailabilities = (agendaId: string) => {
  return useSuspenseQuery(
    orpc.agenda.getAvailabilities.queryOptions({ input: { agendaId } }),
  );
};

export const useToggleActiveAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.availabilities.toggleActive.mutationOptions({
      onSuccess: (data) => {
        toast.success("Disponibilidade atualizada com sucesso");
        queryClient.invalidateQueries(
          orpc.agenda.getAvailabilities.queryOptions({
            input: { agendaId: data.availability.agendaId },
          }),
        );
      },
    }),
  );
};

// TimeSlots

export const useSuspenseTimeSlots = (availabilityId: string) => {
  return useSuspenseQuery(
    orpc.agenda.timeslots.getMany.queryOptions({ input: { availabilityId } }),
  );
};

export const useCreateTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.timeslots.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Horário criado com sucesso");
        queryClient.invalidateQueries(
          orpc.agenda.timeslots.getMany.queryOptions({
            input: { availabilityId: data.timeslots.availabilityId },
          }),
        );
      },
    }),
  );
};

export const useUpdateTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.timeslots.update.mutationOptions({
      onSuccess: (data) => {
        toast.success("Horário atualizado com sucesso");
        queryClient.invalidateQueries(
          orpc.agenda.timeslots.getMany.queryOptions({
            input: { availabilityId: data.timeSlot.availabilityId },
          }),
        );
      },
    }),
  );
};

export const useDeleteTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.timeslots.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success("Horário deletado com sucesso");
        queryClient.invalidateQueries(
          orpc.agenda.timeslots.getMany.queryOptions({
            input: { availabilityId: data.deletedTimeSlot.availabilityId },
          }),
        );
      },
    }),
  );
};
