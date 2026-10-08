import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Fichas do cliente pelo link público (sem login). */
export function useClientRecords(params: { token: string; periodKey?: string; memberId?: string }) {
  return useQuery({
    ...orpc.formRecords.public.list.queryOptions({ input: { token: params.token, periodKey: params.periodKey, memberId: params.memberId } }),
    retry: false,
  });
}

/** Uma ficha em leitura, pelo mesmo token — alimenta a visão rápida do cliente. */
export function useClientRecordResponse(params: { token: string; responseId: string | null }) {
  return useQuery({
    ...orpc.form.getResponseByToken.queryOptions({ input: { token: params.token, responseId: params.responseId ?? "" } }),
    enabled: Boolean(params.responseId),
    retry: false,
  });
}

/** Gera (ou reaproveita) o link público do cliente, para montar o endereço das fichas dele. */
export function useClientPublicLink() {
  return useMutation(orpc.leads.generatePublicLink.mutationOptions({}));
}
