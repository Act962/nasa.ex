import {
  buildNfseNacionalPayload,
  validateNacionalBeforeEmit,
} from "@/http/focus-nfe/build-nfse-nacional-payload";
import { emitirNfseNacional } from "@/http/focus-nfe/emitir-nfse-nacional";
import { consultarNfseNacional } from "@/http/focus-nfe/consultar-nfse-nacional";
import { cancelarNfseNacional } from "@/http/focus-nfe/cancelar-nfse-nacional";
import type { EmitParams, EmitResult, NfseProvider } from "./nfse-provider";

export const nacionalNfseProvider: NfseProvider = {
  standard: "NACIONAL",
  invoiceType: "NFSE_NACIONAL",
  webhookEvent: "nfsen",

  validate: validateNacionalBeforeEmit,

  async emitir({
    ref,
    source,
    profile,
    overrides,
    environment,
    companyToken,
  }: EmitParams): Promise<EmitResult> {
    const payload = buildNfseNacionalPayload(source, profile, overrides);
    const response = await emitirNfseNacional(
      ref,
      payload,
      environment,
      companyToken,
    );
    return { response, payload };
  },

  consultar: consultarNfseNacional,
  cancelar: cancelarNfseNacional,
};
