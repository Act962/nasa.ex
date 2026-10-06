"use client";

import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Vincula a empresa recém-criada ao parceiro do link de indicação (cookie `nasa_ref`). */
export function useConsumePartnerReferral() {
  return useMutation({
    mutationFn: (variables: { organizationId: string }) =>
      orpc.partner.consumeReferralFromCookie.call(variables),
  });
}
