import type {
  FiscalCompanyProfile,
  ForgeContract,
} from "@/generated/prisma/client";
import type { FiscalEnvironment, FiscalInvoiceType } from "@/generated/prisma/enums";
import type { FocusNfseResponse } from "@/http/focus-nfe/types";
import type {
  IssueOverrides,
  PreflightResult,
} from "@/http/focus-nfe/build-nfse-payload";

export type NfseStandard = "MUNICIPAL" | "NACIONAL";

export type NfseWebhookEvent = "nfse" | "nfsen";

export type EmitParams = {
  ref: string;
  contract: ForgeContract;
  profile: FiscalCompanyProfile;
  overrides: IssueOverrides;
  environment: FiscalEnvironment;
  companyToken: string;
};

export type EmitResult = {
  response: FocusNfseResponse;
  payload: unknown;
};

// Abstração injetável que unifica emissão/consulta/cancelamento de NFS-e
// independente do padrão (municipal ou nacional). Os handlers resolvem um
// provider e delegam, sem ramificar por padrão inline.
export interface NfseProvider {
  readonly standard: NfseStandard;
  readonly invoiceType: FiscalInvoiceType;
  readonly webhookEvent: NfseWebhookEvent;

  validate(
    contract: ForgeContract,
    profile: FiscalCompanyProfile,
    overrides: IssueOverrides,
  ): PreflightResult;

  emitir(params: EmitParams): Promise<EmitResult>;

  consultar(
    ref: string,
    environment: FiscalEnvironment,
    companyToken: string,
  ): Promise<FocusNfseResponse>;

  cancelar(
    ref: string,
    justificativa: string,
    environment: FiscalEnvironment,
    companyToken: string,
  ): Promise<void>;
}
