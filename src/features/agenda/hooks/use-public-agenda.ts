import { DayOfWeek } from "@/generated/prisma/enums";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseQueryPublicAgendaProps {
  orgSlug: string;
  agendaSlug: string;
}

export const useQueryPublicAgenda = ({
  orgSlug,
  agendaSlug,
}: UseQueryPublicAgendaProps) => {
  const { data, isLoading } = useQuery(
    orpc.agenda.public.get.queryOptions({
      input: {
        orgSlug,
        agendaSlug,
      },
    }),
  );

  return {
    agenda: data?.agenda,
    isLoading,
  };
};

interface UseQueryPublicAgendaTimeSlotsProps {
  orgSlug: string;
  agendaSlug: string;
  date: string;
}

export const useQueryPublicAgendaTimeSlots = ({
  orgSlug,
  agendaSlug,
  date,
}: UseQueryPublicAgendaTimeSlotsProps) => {
  const enabled = !!(orgSlug && agendaSlug && date);
  const { data, isLoading } = useQuery({
    ...orpc.agenda.public.getTimeSlots.queryOptions({
      input: { orgSlug, agendaSlug, date },
    }),
    enabled,
  });

  return {
    timeSlots: data?.timeSlots,
    isLoading: enabled ? isLoading : false,
  };
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.agenda.public.appointment.create.mutationOptions({
      onSuccess: () => {
        toast.success("Agendamento realizado com sucesso!");
      },
      onError: (error) => {
        console.error(error);
        toast.error("Erro ao criar agendamento: " + error.message);
      },
    }),
  );
};
