"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { client, orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

export function useCompanyCredentials(params: { enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.accounting.credentials.list.queryOptions({ input: {} }),
    enabled: params.enabled ?? true,
    retry: false,
  });
}

export function useCreateCompanyCredential() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.credentials.create.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useUpdateCompanyCredential() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.credentials.update.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useDeleteCompanyCredential() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.credentials.delete.mutationOptions(), onSuccess: invalidateAccounting });
}

export function isWebauthnSupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

/**
 * Revelar = desafio do financeiro (`payment.access.startWebauthnAuth`) →
 * biometria no aparelho → servidor confere e devolve a senha.
 */
export function useRevealCompanyCredential() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({
    mutationFn: async (credentialId: string) => {
      const { options } = await client.payment.access.startWebauthnAuth({});
      const webauthnResponse = await startAuthentication({
        optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
      });
      const { secret } = await client.accounting.credentials.reveal({ credentialId, webauthnResponse });
      return secret;
    },
    onSuccess: invalidateAccounting,
  });
}

/** Cadastra Face ID / Touch ID / Windows Hello no acesso do financeiro. */
export function useRegisterPaymentPasskey() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({
    mutationFn: async () => {
      const { options } = await client.payment.access.startWebauthnReg({});
      const registrationResponse = await startRegistration({
        optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
      });
      const { ok: isRegistered } = await client.payment.access.finishWebauthnReg({
        response: registrationResponse,
        label: "Cofre da aba Contábil",
      });
      if (!isRegistered) throw new Error("Não foi possível cadastrar a biometria.");
      return isRegistered;
    },
    onSuccess: invalidateAccounting,
  });
}

export function useCompanyCertificates(params: { enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.accounting.credentials.listCertificates.queryOptions({ input: {} }),
    enabled: params.enabled ?? true,
    retry: false,
  });
}

export function useUploadCompanyCertificate() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({
    ...orpc.accounting.credentials.uploadCertificate.mutationOptions(),
    onSuccess: invalidateAccounting,
  });
}

export function useDeleteCompanyCertificate() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({
    ...orpc.accounting.credentials.deleteCertificate.mutationOptions(),
    onSuccess: invalidateAccounting,
  });
}
