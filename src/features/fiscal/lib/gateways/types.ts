// PORT do gateway fiscal: abstrai o provedor de emissão de NFS-e (NFE.io,
// Focus NFe, ...) atrás de uma interface única. Os handlers oRPC/Inngest/rotas
// resolvem um adapter pelo registry (factory.ts) e delegam — nunca importam
// clients HTTP de um gateway diretamente.

import type {
  FiscalCompanyProfile,
  FiscalInvoice,
  ForgeContract,
} from "@/generated/prisma/client";
import type {
  FiscalEnvironment,
  FiscalGateway,
  FiscalInvoiceStatus,
  FiscalInvoiceType,
  NfseStandard,
} from "@/generated/prisma/enums";
import type {
  IssueOverrides,
  PreflightResult,
} from "@/http/focus-nfe/build-nfse-payload";

export type { PreflightResult };

export type FiscalIssueOverrides = IssueOverrides & {
  // Código do serviço no formato do município (NFE.io) — distinto do item LC116.
  cityServiceCode?: string;
  taxationType?: string;
};

export type CompanyProfileDraft = {
  documentoTipo: "cnpj" | "cpf";
  documentoDigits: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  openingDate: Date | null;
  legalNature: string | null;
  taxRegime: string | null;
  municipio: string;
  codigoMunicipio: string;
  inscricaoMunicipal: string;
  optanteSimplesNacional: boolean;
  simplesNacionalMei: boolean;
  regimeEspecialTributacao: string | null;
  nfseStandardPreference: NfseStandard | null;
  supportedByFocusFromClient: boolean;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cep: string;
  uf: string;
  defaultAliquotaIss: number;
  defaultCodigoCnae: string | null;
  environment: FiscalEnvironment;
};

export type CompanySyncInput = {
  organizationId: string;
  draft: CompanyProfileDraft;
  existingProfile: FiscalCompanyProfile | null;
  certificate: { fileBase64: string; password: string } | null;
};

// Colunas gateway-specific que os adapters podem devolver para persistência.
export type CompanyProfilePatch = Partial<
  Pick<
    FiscalCompanyProfile,
    | "supportedByFocus"
    | "nfseStandard"
    | "focusEmpresaRegistered"
    | "focusEmpresaId"
    | "focusTokenProducao"
    | "focusTokenHomologacao"
    | "focusCertificadoUploadedAt"
    | "focusWebhookIdProducao"
    | "focusWebhookIdHomologacao"
    | "focusWebhookIdNfsenProducao"
    | "focusWebhookIdNfsenHomologacao"
    | "nfeIoCompanyId"
    | "nfeIoFiscalStatus"
    | "nfeIoCertificateStatus"
    | "nfeIoCertificateExpiresOn"
  >
>;

export type CompanySyncResult = {
  registered: boolean;
  profilePatch: CompanyProfilePatch;
};

export type CertificateUpload = {
  file: Buffer;
  fileName: string;
  password: string;
};

export type IssueInvoiceParams = {
  ref: string;
  contract: ForgeContract;
  profile: FiscalCompanyProfile;
  overrides: FiscalIssueOverrides;
  environment: FiscalEnvironment;
};

export type InvoiceSnapshot = {
  status: FiscalInvoiceStatus;
  rawStatus: string;
  externalId: string | null;
  numero: string | null;
  codigoVerificacao: string | null;
  urlEspelho: string | null;
  urlDanfse: string | null;
  caminhoXml: string | null;
  errorMessage: string | null;
  providerResponse: unknown;
};

export type IssueInvoiceResult = InvoiceSnapshot & {
  invoiceType: FiscalInvoiceType;
  requestPayload: unknown;
};

export type InvoiceLocator = {
  invoice: FiscalInvoice;
  profile: FiscalCompanyProfile;
};

export type InvoiceFileResult =
  | { kind: "buffer"; buffer: Buffer; contentType: string }
  | { kind: "redirect"; url: string };

// Evento canônico de webhook — Focus correlaciona por `ref`, NFE.io pelo id
// externo da nota. O consumidor (Inngest) resolve a invoice pelo que existir.
export type FiscalWebhookEvent = {
  gateway: FiscalGateway;
  ref: string | null;
  externalId: string | null;
  rawStatus: string | null;
  errorMessages: string[] | null;
};

// Violação de regra de negócio do gateway (ex.: padrão municipal indisponível,
// prestador CPF não suportado). Handlers convertem em BAD_REQUEST.
export class FiscalGatewayValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalGatewayValidationError";
  }
}

export interface FiscalGatewayAdapter {
  readonly id: FiscalGateway;

  syncCompany(input: CompanySyncInput): Promise<CompanySyncResult>;
  // Executado após o upsert do perfil (algumas integrações precisam do id
  // persistido — ex.: URL de webhook da Focus). Patch retornado é persistido.
  afterProfileSaved(
    profile: FiscalCompanyProfile,
    input: CompanySyncInput,
  ): Promise<CompanyProfilePatch | null>;
  getCompanyStatus(
    profile: FiscalCompanyProfile,
  ): Promise<CompanyProfilePatch | null>;
  deleteCompany(profile: FiscalCompanyProfile): Promise<void>;
  uploadCertificate(
    profile: FiscalCompanyProfile,
    certificate: CertificateUpload,
  ): Promise<CompanyProfilePatch>;

  validateBeforeIssue(params: IssueInvoiceParams): PreflightResult;
  issueInvoice(params: IssueInvoiceParams): Promise<IssueInvoiceResult>;
  getInvoice(locator: InvoiceLocator): Promise<InvoiceSnapshot>;
  cancelInvoice(locator: InvoiceLocator, justificativa: string): Promise<void>;
  downloadInvoicePdf(locator: InvoiceLocator): Promise<InvoiceFileResult | null>;
  downloadInvoiceXml(locator: InvoiceLocator): Promise<InvoiceFileResult | null>;
}
