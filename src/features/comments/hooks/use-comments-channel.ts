"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useSocialAccounts, type SocialAccount } from "@/features/social-accounts/hooks/use-social-accounts";

/** O que o Comments lê de uma conta. As contas em si vêm de `use-social-accounts` (spec 0069). */

const SELECTED_ACCOUNT_PARAM = "conta";
const SELECTED_ACCOUNT_STORAGE_KEY = "orbita:comments-account";

function readRememberedAccountId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_ACCOUNT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberAccountId(accountId: string) {
  try {
    window.localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, accountId);
  } catch {
    // Modo privado: a escolha vale só pela URL.
  }
}

/** URL primeiro, depois a última escolha neste navegador, depois a primeira ativa (spec 0069, D-6 e CB-4). */
function pickAccount(accounts: SocialAccount[], requestedId: string | null, rememberedId: string | null) {
  return (
    accounts.find((account) => account.id === requestedId) ??
    accounts.find((account) => account.id === rememberedId) ??
    accounts.find((account) => account.status === "ACTIVE") ??
    accounts[0] ??
    null
  );
}

/** Conta do Instagram em que o usuário está trabalhando no Comments (spec 0069, RF-12). */
export function useSelectedCommentsAccount() {
  const { data, isLoading } = useSocialAccounts();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // As contas só existem depois da query, no navegador: ler o storage aqui não diverge do servidor.
  const accounts = (data?.accounts ?? []).filter((account) => account.provider === "INSTAGRAM");
  const requestedId = searchParams.get(SELECTED_ACCOUNT_PARAM);
  const selectedAccount = pickAccount(accounts, requestedId, readRememberedAccountId());
  const selectedAccountId = selectedAccount?.id ?? null;

  const selectAccount = (accountId: string) => {
    rememberAccountId(accountId);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(SELECTED_ACCOUNT_PARAM, accountId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  // URL sem conta, ou apontando para conta que não é mais desta empresa: corrige.
  useEffect(() => {
    if (!selectedAccountId || requestedId === selectedAccountId) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(SELECTED_ACCOUNT_PARAM, selectedAccountId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [selectedAccountId, requestedId, pathname, router, searchParams]);

  return {
    accounts,
    selectedAccount,
    selectAccount,
    canManage: data?.canManage ?? false,
    isLoading,
  };
}

export function useCommentsContent(channelId: string | null | undefined, enabled = true) {
  return useQuery({
    ...orpc.comments.channel.listContent.queryOptions({ input: { channelId: channelId ?? "" } }),
    enabled: Boolean(channelId) && enabled,
  });
}

/** Tracking que recebe os leads desta conta no tracking-chat (spec 0062). */
export function useCommentsLeadTracking(channelId: string) {
  return useQuery(orpc.comments.channel.leadTracking.queryOptions({ input: { channelId } }));
}

export function useSetCommentsLeadTracking() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.comments.channel.setLeadTracking.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.comments.key() }),
    }),
  );
}
