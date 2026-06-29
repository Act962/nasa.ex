"use client";

import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/**
 * Hook de mutation pra extrair valor + descrição de um arquivo de
 * orçamento/OS/proposta usando IA (Claude Haiku 4.5 + Vision).
 *
 * Input: `{ fileKey: string }` — chave S3/R2 do arquivo já subido.
 * Output: `{ valueCents, description, confidence, isProposalLike }`.
 *
 * Toasts/erros ficam no componente que consome o hook (`onSuccess` /
 * `onError` no `mutate()`).
 */
export function useExtractBudget() {
  return useMutation(orpc.ia.extractBudget.mutationOptions({}));
}
