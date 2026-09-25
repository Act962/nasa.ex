"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc, client } from "@/lib/orpc";
import {
  checkPushAvailability,
  createSubscription,
  getExistingSubscription,
  getPushPermission,
  removeSubscription,
  requestPushPermission,
  type PushAvailability,
  type PushPermission,
} from "@/lib/notifications/client/push-client";

/**
 * Liga a camada de browser do Web Push ao backend (spec 0022).
 *
 * Reutilizável por qualquer tela: não cita caso de uso nenhum. Quem quiser um
 * botão de ativar push importa este hook.
 */
export interface WebPushState {
  availability: PushAvailability;
  permission: PushPermission;
  /** Este browser já está inscrito. */
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useWebPush() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<WebPushState>({
    availability: "unsupported",
    permission: "default",
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  // Estado real só existe no browser: a primeira leitura é depois da montagem.
  useEffect(() => {
    let active = true;

    // Disponibilidade e permissão são síncronas. Resolvê-las antes de qualquer
    // I/O garante que o botão apareça: se dependêsse do await abaixo, uma API do
    // browser pendurada deixaria `isLoading` eterno e o componente invisível.
    const availability = checkPushAvailability();
    const permission = getPushPermission();
    setState((current) => ({
      ...current,
      availability,
      permission,
      isLoading: false,
    }));

    if (availability !== "ready") return;

    getExistingSubscription()
      .then((existing) => {
        if (active) {
          setState((current) => ({
            ...current,
            isSubscribed: Boolean(existing),
          }));
        }
      })
      .catch(() => {
        // Sem inscrição legível o botão segue útil: oferece ativar.
      });

    return () => {
      active = false;
    };
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries(
      orpc.push.listMine.queryOptions({ input: {} }),
    );
  }, [queryClient]);

  const subscribe = useMutation({
    mutationFn: async () => {
      const permission = await requestPushPermission();
      if (permission !== "granted") {
        setState((current) => ({ ...current, permission }));
        throw new Error(
          permission === "denied"
            ? "Permissão de notificação negada no navegador."
            : "Permissão de notificação não concedida.",
        );
      }

      const payload = await createSubscription();
      await client.push.subscribe(payload);
      return payload;
    },
    onSuccess: () => {
      setState((current) => ({
        ...current,
        permission: "granted",
        isSubscribed: true,
        error: null,
      }));
      invalidate();
    },
    onError: (error) => {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Falha ao ativar.",
      }));
    },
  });

  const unsubscribe = useMutation({
    mutationFn: async () => {
      const endpoint = await removeSubscription();
      // Sem inscrição no browser não há o que apagar no banco.
      if (endpoint) await client.push.unsubscribe({ endpoint });
      return endpoint;
    },
    onSuccess: () => {
      setState((current) => ({ ...current, isSubscribed: false, error: null }));
      invalidate();
    },
    onError: (error) => {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Falha ao desativar.",
      }));
    },
  });

  return {
    ...state,
    isPending: subscribe.isPending || unsubscribe.isPending,
    subscribe: subscribe.mutate,
    unsubscribe: unsubscribe.mutate,
  };
}

/** Inscrições do usuário, para listar os dispositivos ligados. */
export function useMyPushSubscriptions(enabled = true) {
  return useQuery({
    ...orpc.push.listMine.queryOptions({ input: {} }),
    enabled,
  });
}
