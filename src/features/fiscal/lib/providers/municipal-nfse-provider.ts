import {
  buildNfsePayload,
  validateBeforeEmit,
} from "@/http/focus-nfe/build-nfse-payload";
import { emitirNfse } from "@/http/focus-nfe/emitir-nfse";
import { consultarNfse } from "@/http/focus-nfe/consultar-nfse";
import { cancelarNfse } from "@/http/focus-nfe/cancelar-nfse";
import { resolveMunicipioRequirements } from "../municipio-requirements";
import type { EmitParams, EmitResult, NfseProvider } from "./nfse-provider";

export const municipalNfseProvider: NfseProvider = {
  standard: "MUNICIPAL",
  invoiceType: "NFSE",
  webhookEvent: "nfse",

  validate: (contract, profile, overrides, environment) =>
    validateBeforeEmit(
      contract,
      profile,
      overrides,
      resolveMunicipioRequirements(profile.codigoMunicipio),
      environment,
    ),

  async emitir({
    ref,
    contract,
    profile,
    overrides,
    environment,
    companyToken,
  }: EmitParams): Promise<EmitResult> {
    const payload = buildNfsePayload(
      contract,
      profile,
      overrides,
      resolveMunicipioRequirements(profile.codigoMunicipio),
    );
    const response = await emitirNfse(ref, payload, environment, companyToken);
    return { response, payload };
  },

  consultar: consultarNfse,
  cancelar: cancelarNfse,
};
