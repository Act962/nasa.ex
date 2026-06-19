# Etapa 5 — React Hooks

## Objetivo

Criar os hooks do domínio fiscal em `src/features/fiscal/hooks/`. Seguir o padrão do CLAUDE.md item 9: um arquivo por recurso, hooks de query embrulham `useQuery`, hooks de mutation já invalidam.

---

## `src/features/fiscal/hooks/use-fiscal-profile.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc"; // ou o import correto do cliente oRPC

export function useFiscalProfile() {
  return useQuery(orpc.fiscal.profile.get.queryOptions({}));
}

export function useUpsertFiscalProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.profile.upsert.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}
```

---

## `src/features/fiscal/hooks/use-fiscal-invoices.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useFiscalInvoicesByContract(contractId: string, enabled = true) {
  return useQuery(
    orpc.fiscal.invoices.listByContract.queryOptions({ contractId }, { enabled: enabled && !!contractId })
  );
}

export function useFiscalInvoice(id: string, enabled = true) {
  return useQuery(
    orpc.fiscal.invoices.get.queryOptions({ id }, { enabled: enabled && !!id })
  );
}

export function useIssueFiscalInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.invoices.issueFromContract.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}

export function useRefreshFiscalInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.invoices.refreshStatus.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}

export function useCancelFiscalInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.invoices.cancel.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}
```

---

## Notas

- Verificar o import correto do cliente oRPC — usar o mesmo padrão de `src/features/forge/hooks/use-forge.ts`.
- `queryKey: ["fiscal"]` invalida todas as queries do domínio fiscal. Se precisar de granularidade, usar `["fiscal", "invoices", contractId]`.
- Toasts e redirects ficam nos componentes via `mutate(input, { onSuccess, onError })`, nunca nos hooks.

---

## Validação desta etapa

TypeScript deve compilar sem erros:
```bash
pnpm tsc --noEmit
```
