import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

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

export const useQueryAppointment = ({
  appointmentId,
}: {
  appointmentId: string;
}) => {
  const { data, isLoading } = useQuery({
    ...orpc.agenda.appointments.get.queryOptions({
      input: { appointmentId },
    }),
    // Não busca quando appointmentId está vazio (Sheet fechado mas ainda montado)
    enabled: !!appointmentId,
  });

  return {
    appointment: data?.appointment,
    isLoading,
  };
};
