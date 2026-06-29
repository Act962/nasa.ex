"use client";

/**
 * Hook que orquestra o modo Step-by-Step.
 *
 * Ações:
 *   - start(triggerNodeId)  — inicia teste a partir de um trigger
 *   - stepNode(branchChoice?) — valida o nó atual e marca como passed/failed,
 *                                avança pro próximo (resolvendo branch)
 *   - skipNode()             — marca atual como skipped e avança "main"
 *   - rollback()             — volta um passo no histórico
 *   - reset()                — sai do modo, limpa tudo
 *   - setMockLead(patch)     — atualiza mock context
 *
 * State vive em atoms (step-by-step-atoms.ts). Hook é a ÚNICA forma
 * recomendada de mutar — componentes não devem usar setStepByStepState
 * direto pra evitar inconsistências.
 */
import { useAtom, useSetAtom } from "jotai";
import { useMutation } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import {
  resetStepByStepAtom,
  stepByStepStateAtom,
  type MockLeadContext,
} from "../store/step-by-step-atoms";

export function useStepByStep(workflowId: string) {
  const [state, setState] = useAtom(stepByStepStateAtom);
  const resetState = useSetAtom(resetStepByStepAtom);
  const { fitView } = useReactFlow();

  const stepMutation = useMutation(orpc.workflow.stepNode.mutationOptions());

  /** Inicia teste a partir do trigger escolhido. */
  const start = useCallback(
    (triggerNodeId: string) => {
      setState((prev) => ({
        ...prev,
        active: true,
        startTriggerNodeId: triggerNodeId,
        currentNodeId: triggerNodeId,
        nodeStatuses: { [triggerNodeId]: "current" },
        edgeStatuses: {},
        nodeErrors: {},
        nodeWarnings: {},
        visitOrder: [triggerNodeId],
        branchChoices: {},
      }));
      fitView({ nodes: [{ id: triggerNodeId }], duration: 400, padding: 0.4 });
    },
    [setState, fitView],
  );

  /** Avança 1 passo a partir do nó atual. */
  const stepNode = useCallback(
    async (branchChoice?: string) => {
      if (!state.currentNodeId) return;
      const currentId = state.currentNodeId;

      const result = await stepMutation.mutateAsync({
        workflowId,
        nodeId: currentId,
        branchChoice,
        mockLead: state.mockLead,
      });

      const nextNodeId = result.nextNodeIds[0] ?? null;
      const chosenEdgeIds = result.outgoingEdges
        .filter((e) => e.isChosen)
        .map((e) => e.edgeId);
      const otherEdgeIds = result.outgoingEdges
        .filter((e) => !e.isChosen)
        .map((e) => e.edgeId);

      setState((prev) => {
        const next = { ...prev };

        // Status do nó atual
        next.nodeStatuses = {
          ...prev.nodeStatuses,
          [currentId]: result.status === "error" ? "failed" : "passed",
        };
        next.nodeErrors = { ...prev.nodeErrors, [currentId]: result.errors };
        next.nodeWarnings = {
          ...prev.nodeWarnings,
          [currentId]: result.warnings,
        };

        // Edges
        const edgeUpdates: Record<string, "passed" | "failed" | "skipped"> = {};
        for (const eid of chosenEdgeIds) {
          edgeUpdates[eid] = result.status === "error" ? "failed" : "passed";
        }
        for (const eid of otherEdgeIds) {
          edgeUpdates[eid] = "skipped";
        }
        next.edgeStatuses = { ...prev.edgeStatuses, ...edgeUpdates };

        // Branch escolhido (pra histórico)
        if (branchChoice) {
          next.branchChoices = {
            ...prev.branchChoices,
            [currentId]: branchChoice,
          };
        }

        // Próximo nó vira current
        if (nextNodeId && result.status !== "error") {
          next.currentNodeId = nextNodeId;
          next.nodeStatuses = {
            ...next.nodeStatuses,
            [nextNodeId]: "current",
          };
          next.visitOrder = [...prev.visitOrder, nextNodeId];
        } else {
          // Sem próximo ou erro — para de avançar
          next.currentNodeId = null;
        }

        return next;
      });

      // Auto-foco no próximo nó (zoom + center)
      if (nextNodeId && result.status !== "error") {
        setTimeout(() => {
          fitView({ nodes: [{ id: nextNodeId }], duration: 400, padding: 0.4 });
        }, 100);
      }

      if (result.status === "error") {
        toast.error(`Teste parou em ${result.nodeName}: ${result.errors[0] ?? "erro"}`);
      } else if (result.status === "warning") {
        toast.warning(`${result.nodeName} passou com avisos`);
      }

      return result;
    },
    [state.currentNodeId, state.mockLead, stepMutation, setState, workflowId, fitView],
  );

  /** Volta um passo (last visited). */
  const rollback = useCallback(() => {
    setState((prev) => {
      if (prev.visitOrder.length <= 1) return prev;
      const newOrder = prev.visitOrder.slice(0, -1);
      const lastVisitedRemoved = prev.visitOrder[prev.visitOrder.length - 1];
      const newCurrent = newOrder[newOrder.length - 1];

      const newStatuses = { ...prev.nodeStatuses };
      delete newStatuses[lastVisitedRemoved];
      newStatuses[newCurrent] = "current";

      const newErrors = { ...prev.nodeErrors };
      delete newErrors[lastVisitedRemoved];
      const newWarnings = { ...prev.nodeWarnings };
      delete newWarnings[lastVisitedRemoved];

      return {
        ...prev,
        currentNodeId: newCurrent,
        visitOrder: newOrder,
        nodeStatuses: newStatuses,
        nodeErrors: newErrors,
        nodeWarnings: newWarnings,
      };
    });
  }, [setState]);

  const reset = useCallback(() => {
    resetState();
  }, [resetState]);

  const setMockLead = useCallback(
    (patch: Partial<MockLeadContext>) => {
      setState((prev) => ({
        ...prev,
        mockLead: { ...prev.mockLead, ...patch },
      }));
    },
    [setState],
  );

  return {
    state,
    start,
    stepNode,
    rollback,
    reset,
    setMockLead,
    isLoading: stepMutation.isPending,
  };
}
