import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/**
 * Busca a conversa inteira (todas as mensagens, escopo de org) sob demanda,
 * para o diálogo de exportar. É um GET usado como mutation porque dispara
 * só no clique de "Exportar", não no render.
 */
export function useExportConversation() {
  return useMutation(orpc.message.export.mutationOptions());
}
