import {
  buildNfsePayload,
  validateBeforeEmit,
} from "@/http/focus-nfe/build-nfse-payload";
import { emitirNfse } from "@/http/focus-nfe/emitir-nfse";
import { consultarNfse } from "@/http/focus-nfe/consultar-nfse";
import { cancelarNfse } from "@/http/focus-nfe/cancelar-nfse";
import type { EmitParams, EmitResult, NfseProvider } from "./nfse-provider";

export const municipalNfseProvider: NfseProvider = {
  standard: "MUNICIPAL",
  invoiceType: "NFSE",
  webhookEvent: "nfse",

  validate: validateBeforeEmit,

  async emitir({
    ref,
    contract,
    profile,
    overrides,
    environment,
    companyToken,
  }: EmitParams): Promise<EmitResult> {
    const payload = buildNfsePayload(contract, profile, overrides);
    const response = await emitirNfse(ref, payload, environment, companyToken);
    return { response, payload };
  },

  consultar: consultarNfse,
  cancelar: cancelarNfse,
};
