import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

// Agenda

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

export const useUpdateAgenda = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.update.mutationOptions({
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

// Appointments

export const useQueryAppointmentsByOrg = () => {
  const { data, isLoading } = useQuery(
    orpc.agenda.appointments.getManyByOrg.queryOptions({}),
  );
  return {
    appointments: data?.appointments ?? [],
    isLoading,
  };
};

export const useQueryAgendasByTracking = (trackingId: string) => {
  return useQuery(
    orpc.agenda.getByTracking.queryOptions({ input: { trackingId } }),
  );
};

export const useAdminCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.appointments.createAdmin.mutationOptions({
      onSuccess: (data) => {
        toast.success("Agendamento criado com sucesso!");
        queryClient.invalidateQueries(
          orpc.agenda.appointments.getManyByTracking.queryOptions({
            input: { trackingId: data.appointment.trackingId ?? "" },
          }),
        );
        queryClient.invalidateQueries(
          orpc.agenda.appointments.getManyByOrg.queryOptions({}),
        );
      },
      onError: (error) => {
        toast.error("Erro ao criar agendamento: " + error.message);
      },
    }),
  );
};

// DateOverrides

export const useSuspenseDateOverrides = (agendaId: string) => {
  return useSuspenseQuery(
    orpc.agenda.dateOverrides.getMany.queryOptions({ input: { agendaId } }),
  );
};

export const useToggleDateOverride = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.dateOverrides.toggle.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.dateOverride.isBlocked ? "Data bloqueada" : "Data desbloqueada",
        );
        queryClient.invalidateQueries(
          orpc.agenda.dateOverrides.getMany.queryOptions({
            input: { agendaId: data.dateOverride.agendaId },
          }),
        );
      },
    }),
  );
};

export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.appointments.reschedule.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.agenda.appointments.getManyByTracking.queryOptions({
            input: { trackingId: data.appointment.trackingId ?? "" },
          }),
        );
        queryClient.invalidateQueries(
          orpc.agenda.appointments.getManyByOrg.queryOptions({}),
        );
      },
      onError: (error) => {
        toast.error("Erro ao reagendar: " + error.message);
      },
    }),
  );
};

// DateAvailabilities (Dia mode)

export const useSuspenseDateAvailabilities = (agendaId: string) => {
  return useSuspenseQuery(
    orpc.agenda.dateAvailabilities.getMany.queryOptions({ input: { agendaId } }),
  );
};

export const useQueryDateAvailabilities = (agendaId: string) => {
  return useQuery(
    orpc.agenda.dateAvailabilities.getMany.queryOptions({ input: { agendaId } }),
  );
};

export const useUpsertDateAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.dateAvailabilities.upsert.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.agenda.dateAvailabilities.getMany.queryOptions({
            input: { agendaId: data.dateAvailability.agendaId },
          }),
        );
      },
      onError: (error) => {
        toast.error("Erro ao configurar data: " + error.message);
      },
    }),
  );
};

export const useDeleteDateAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.dateAvailabilities.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.agenda.dateAvailabilities.getMany.key({}),
        });
      },
    }),
  );
};

export const useCreateDateAvailabilitySlot = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.dateAvailabilities.slots.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.agenda.dateAvailabilities.getMany.key({}),
        });
      },
    }),
  );
};

export const useUpdateDateAvailabilitySlot = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.dateAvailabilities.slots.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.agenda.dateAvailabilities.getMany.key({}),
        });
      },
    }),
  );
};

export const useDeleteDateAvailabilitySlot = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.dateAvailabilities.slots.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.agenda.dateAvailabilities.getMany.key({}),
        });
      },
    }),
  );
};

export const useCancelAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.appointments.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Agendamento cancelado com sucesso");
        queryClient.invalidateQueries(
          orpc.agenda.appointments.getManyByTracking.queryOptions({
            input: { trackingId: "" },
          }),
        );
        queryClient.invalidateQueries(
          orpc.agenda.appointments.getManyByOrg.queryOptions({}),
        );
      },
    }),
  );
};
