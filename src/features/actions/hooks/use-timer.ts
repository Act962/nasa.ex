import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTimerStore } from "../lib/timer-store";
import { useEffect } from "react";

/**
 * Hook para iniciar o timer de uma ação.
 * Irá pausar automaticamente qualquer outro timer ativo do usuário.
 */
export const useStartTimer = () => {
  const queryClient = useQueryClient();
  const { start } = useTimerStore((state) => state.actions);

  return useMutation(
    orpc.action.startTimer.mutationOptions({
      onSuccess: (data, variables) => {
        // Sincroniza o estado global imediatamente (Otimista)
        // Usamos o tempo acumulado retornado pelo servidor
        start(
          variables.actionId,
          new Date(data.timer.startedAt),
          data.accumulatedSeconds ?? 0,
        );

        // Invalida o timer ativo global
        queryClient.invalidateQueries(
          orpc.action.getActiveTimer.queryOptions(),
        );


        // Invalida todas as queries do prefixo action para garantir que tudo se atualize
        queryClient.invalidateQueries({ queryKey: ["action"] });
      },
    }),
  );
};


/**
 * Hook para parar o timer de uma ação específica.
 */
export const useStopTimer = () => {
  const queryClient = useQueryClient();
  const { stop } = useTimerStore((state) => state.actions);

  return useMutation(
    orpc.action.stopTimer.mutationOptions({
      onSuccess: () => {
        // Para o cronômetro global
        stop();

        queryClient.invalidateQueries(
          orpc.action.getActiveTimer.queryOptions(),
        );

        queryClient.invalidateQueries({ queryKey: ["action"] });
      },
    }),
  );
};


/**
 * Hook para obter o timer ativo do usuário atual.
 */
export const useActiveTimer = () => {
  const { data, isLoading, refetch } = useQuery(
    orpc.action.getActiveTimer.queryOptions(),
  );
  const { sync } = useTimerStore((state) => state.actions);

  // Mantém o Zustand Store sincronizado com a "verdade" do servidor
  useEffect(() => {
    if (data?.activeTimer) {
      sync(
        data.activeTimer.actionId,
        data.activeTimer.startedAt,
        data.accumulatedSeconds ?? 0,
      );
    } else if (data && !data.activeTimer) {
      sync(null, null, 0);
    }
  }, [data, sync]);

  return {
    activeTimer: data?.activeTimer,
    isLoading,
    refetch,
  };
};

