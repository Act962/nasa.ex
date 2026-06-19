import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch, focusFetchMultipart } from "./client";
import type {
  NfsePayload,
  FocusNfseResponse,
  FocusEmpresaResponse,
  FocusWebhookRegistration,
  FocusEmpresaPayload,
} from "./types";

export async function emitirNfse(
  ref: string,
  payload: NfsePayload,
  environment: FiscalEnvironment,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "POST",
    path: `/nfse?ref=${encodeURIComponent(ref)}`,
    body: payload,
    environment,
  });
}

export async function consultarNfse(
  ref: string,
  environment: FiscalEnvironment,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "GET",
    path: `/nfse/${encodeURIComponent(ref)}`,
    environment,
  });
}

export async function cancelarNfse(
  ref: string,
  justificativa: string,
  environment: FiscalEnvironment,
): Promise<void> {
  await focusFetch<void>({
    method: "DELETE",
    path: `/nfse/${encodeURIComponent(ref)}`,
    body: { justificativa },
    environment,
  });
}

export async function registrarWebhook(
  registration: FocusWebhookRegistration,
  environment: FiscalEnvironment,
): Promise<void> {
  await focusFetch<void>({
    method: "POST",
    path: "/hooks",
    body: registration,
    environment,
  });
}

export async function consultarEmpresa(
  cnpj: string,
  environment: FiscalEnvironment,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "GET",
    path: `/empresas/${cnpj.replace(/\D/g, "")}`,
    environment,
  });
}

export async function cadastrarEmpresa(
  payload: FocusEmpresaPayload,
  environment: FiscalEnvironment,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "POST",
    path: "/empresas",
    body: payload,
    environment,
  });
}

export async function uploadCertificadoFocus(
  cnpj: string,
  pfxBuffer: Buffer,
  senha: string,
  environment: FiscalEnvironment,
): Promise<void> {
  const formData = new FormData();
  formData.append(
    "arquivo",
    new Blob([pfxBuffer], { type: "application/x-pkcs12" }),
    "certificado.pfx",
  );
  formData.append("senha", senha);
  await focusFetchMultipart(
    `/empresas/${cnpj.replace(/\D/g, "")}/certificado`,
    formData,
    environment,
  );
}
