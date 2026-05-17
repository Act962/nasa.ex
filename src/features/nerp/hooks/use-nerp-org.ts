"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpOrg() {
  return useQuery(orpc.nerp.org.get.queryOptions({ input: {} }));
}

// Mutation pra verificar disponibilidade. Não invalida cache — o caller usa
// o resultado pra mudar a UI (mostra "disponível" e libera o botão Salvar).
export function useCheckNerpSubdomain() {
  return useMutation(orpc.nerp.org.checkSubdomain.mutationOptions());
}

// Atualiza o subdomínio. Invalida `nerp` pra refletir o novo valor em
// `useNerpOrg` (e em qualquer query derivada — URL pública, etc).
export function useUpdateNerpSubdomain() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.org.updateSubdomain.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}
