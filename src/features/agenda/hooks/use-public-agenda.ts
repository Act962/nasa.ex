import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

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
