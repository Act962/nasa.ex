import { useBroadcasts } from "./use-broadcasts";
import { useContacts } from "./use-contacts";
import { useTemplates } from "./use-templates";
import { useActiveTrackingId } from "./use-active-tracking-id";

/** Totais do menu das Campanhas, por rota da seção. Analytics não tem total. */
export function useCampanhasSectionCounts(): Record<string, number | undefined> {
  const activeTrackingId = useActiveTrackingId();
  const { data: broadcasts } = useBroadcasts();
  const { data: templatesResult } = useTemplates(activeTrackingId ?? undefined);
  const { data: contactsPage } = useContacts({}, 1, 1);

  return {
    "/campanhas?lista=1": broadcasts?.length,
    "/campanhas/templates": activeTrackingId ? templatesResult?.templates.length : 0,
    "/campanhas/contatos": contactsPage?.totalCount,
  };
}
