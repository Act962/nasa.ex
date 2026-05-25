"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Hook de compra de curso (aluno autenticado).
 *
 * Comportamento do resultado:
 *  - `{ kind: "enrolled" }` — matrícula direta (curso gratuito ou
 *    free-access concedido).
 *  - `{ kind: "checkout", checkoutUrl }` — curso pago; redirecionar
 *    o aluno para essa URL do Stripe.
 *  - `{ kind: "already_enrolled" }` — já estava matriculado.
 *
 * Invalida `listMyEnrollments` no sucesso. Toasts e redirect ficam
 * com o componente consumidor (via `onSuccess`/`onError` no `mutate`).
 */
export function useStartCoursePurchase() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.nasaRoute.purchaseCourse.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.listMyEnrollments.queryKey(),
      });
    },
  });
}
