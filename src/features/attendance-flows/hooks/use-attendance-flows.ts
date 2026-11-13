"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Hooks do FlowAstro (spec 0139). Ativar, apagar e salvar o desenho usam as procedures de `workflow`.

function useInvalidateAttendanceFlows() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.attendanceFlow.key() });
}

export function useAttendanceFlows() {
  return useQuery(orpc.attendanceFlow.list.queryOptions());
}

export function useAttendanceFlow(workflowId: string) {
  return useQuery(orpc.attendanceFlow.get.queryOptions({ input: { workflowId } }));
}

export function useAttendanceFlowGraph(workflowId: string) {
  return useQuery({ ...orpc.workflow.getOne.queryOptions({ input: { workflowId } }), refetchOnWindowFocus: false });
}

export function useAttendanceNumberOptions() {
  return useQuery(orpc.attendanceFlow.numberOptions.queryOptions());
}

/** O que o bloco Agente de IA pode liberar: agendas, formulários, Workspaces e documentos da empresa. */
export function useAttendanceAiOptions() {
  return useQuery(orpc.attendanceFlow.aiOptions.queryOptions());
}

/** Campanhas ativas do STAR FRIENDS, para os blocos da promoção (spec 0140). */
export function useAttendanceCampaignStatus() {
  return useQuery(orpc.attendanceFlow.campaignStatus.queryOptions());
}

/** Copia a IA do funil de um número para o bloco; nada fica gravado até o editor salvar o desenho. */
export function useImportFunnelAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trackingId: string) => queryClient.fetchQuery({ ...orpc.attendanceFlow.importFunnelAi.queryOptions({ input: { trackingId } }), staleTime: 0 }),
  });
}

export function useCreateAttendanceFlow() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.attendanceFlow.create.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useDuplicateAttendanceFlow() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.attendanceFlow.duplicate.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useSetAttendanceFlowNumbers() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.attendanceFlow.setNumbers.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useSaveAttendanceFlowGraph() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.workflow.update.updateNodes.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useRenameAttendanceFlow() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.workflow.update.updateName.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useSetAttendanceFlowActive() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.workflow.update.updateIsActive.mutationOptions({ onSuccess: () => invalidate() }));
}

export function useDeleteAttendanceFlow() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.workflow.delete.mutationOptions({ onSuccess: () => invalidate() }));
}

/** Contador de leads por bloco no editor (RF-13). Atualiza a cada 30 s enquanto o editor está aberto. */
export function useAttendanceLeadsByNode(workflowId: string) {
  return useQuery({ ...orpc.attendanceFlow.leadsByNode.queryOptions({ input: { workflowId } }), refetchInterval: 30_000 });
}

export function useRemoveLeadFromAttendanceFlow() {
  const invalidate = useInvalidateAttendanceFlows();
  return useMutation(orpc.attendanceFlow.removeLead.mutationOptions({ onSuccess: () => invalidate() }));
}
