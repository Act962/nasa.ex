import { orpc } from "@/lib/orpc";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

/**
 * Hooks da base unificada de contatos (Campanhas). `useContacts` pagina por
 * cursor; `useContactFilterOptions` alimenta os seletores de coluna/tag/
 * participante do tracking escolhido.
 */

export interface ContactFilters {
  trackingId?: string;
  statusIds?: string[];
  tagsFilter?: string[];
  temperatureFilter?: Array<"COLD" | "WARM" | "HOT" | "VERY_HOT">;
  actionFilter?: "ACTIVE" | "WON" | "LOST";
  participantFilter?: string;
  dateInit?: string;
  dateEnd?: string;
  search?: string;
}

export const useContacts = (
  filters: ContactFilters,
  page: number,
  pageSize: number,
) => {
  return useQuery({
    ...orpc.campanhas.listContacts.queryOptions({
      input: { ...filters, page, pageSize },
    }),
    placeholderData: keepPreviousData,
  });
};

export const useContactFilterOptions = (trackingId?: string) => {
  return useQuery(
    orpc.campanhas.contactFilterOptions.queryOptions({
      input: { trackingId },
    }),
  );
};

export const useAddRecipientsFromContacts = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.addRecipientsFromContacts.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({
          queryKey: orpc.campanhas.get.key({
            input: { id: result.broadcastId },
          }),
        });
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.list.key() });
      },
    }),
  );
};
