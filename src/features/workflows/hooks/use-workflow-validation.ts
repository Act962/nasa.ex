import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Roda `workflow.validate` no servidor pra carregar lista atualizada de
 * issues estruturais + por-nó. Refresca a cada 5s (ou quando o user salva)
 * — barato porque a procedure não roda preflight (UAZAPI/AI key) nem cria
 * runs.
 *
 * Consumido por `WorkflowIssuesProvider` (canvas) e `WorkflowIssuesPanel`
 * (drawer lateral com lista de problemas).
 */
export const useWorkflowValidation = (workflowId: string) => {
  return useQuery(
    orpc.workflow.validate.queryOptions({
      input: { workflowId },
      // Auto-refresh discreto enquanto o editor está aberto. O user
      // costuma trocar entre nodes/configs pesado nesse momento, então
      // pegar tag arquivada/instância caída logo é valioso.
      refetchInterval: 5_000,
      staleTime: 1_000,
    }),
  );
};
