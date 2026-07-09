// Adapter Focus NFe do port FiscalGatewayAdapter. O padrão municipal/nacional
// (NfseProvider) é detalhe interno deste adapter — resolvido pelo
// nfseStandard do perfil (emissão) ou pelo type da invoice (consulta/cancelamento).

import { deletarEmpresa } from "@/http/focus-nfe/deletar-empresa";
import { atualizarEmpresa } from "@/http/focus-nfe/atualizar-empresa";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FocusNfseResponse } from "@/http/focus-nfe/types";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { resolveNfseProvider, resolveNfseProviderByInvoiceType } from "../../../providers/resolve-nfse-provider";
import { registerGateway } from "../../factory";
import { focusStatusToDb } from "../../status-mapping";
import type {
  FiscalGatewayAdapter,
  InvoiceLocator,
  InvoiceSnapshot,
} from "../../types";
import { formatFocusErrorMessage, resolveCompanyToken } from "./company-token";
import { registerFocusWebhooks, syncFocusCompany } from "./sync-company";

function toInvoiceSnapshot(response: FocusNfseResponse): InvoiceSnapshot {
  const status = focusStatusToDb(response.status);
  return {
    status,
    rawStatus: response.status,
    externalId: null,
    numero: response.numero ?? null,
    codigoVerificacao: response.codigo_verificacao ?? null,
    urlEspelho: response.url ?? null,
    urlDanfse: response.url_danfse ?? null,
    caminhoXml: response.caminho_xml_nota_fiscal ?? null,
    errorMessage:
      status === "ERRO"
        ? (formatFocusErrorMessage(response) ?? "Erro desconhecido")
        : null,
    providerResponse: response,
  };
}

export const focusNfeGateway: FiscalGatewayAdapter = {
  id: "FOCUS_NFE",

  syncCompany: syncFocusCompany,
  afterProfileSaved: registerFocusWebhooks,

  async getCompanyStatus() {
    // A Focus não expõe um status de habilitação municipal consultável — o
    // estado é derivado no próprio syncCompany (listarMunicipios).
    return null;
  },

  async deleteCompany(profile) {
    if (profile.focusEmpresaId === null) return;
    try {
      await deletarEmpresa(profile.focusEmpresaId);
    } catch (err) {
      // 404 significa que a empresa já não existe na Focus — prossegue com a limpeza local
      if (!(err instanceof FocusNfeHttpError && err.status === 404)) throw err;
    }
  },

  async uploadCertificate(profile, certificate) {
    if (profile.focusEmpresaId === null)
      throw new Error("Empresa não está cadastrada na Focus NFe.");
    await atualizarEmpresa(profile.focusEmpresaId, {
      arquivo_certificado_base64: certificate.file.toString("base64"),
      senha_certificado: certificate.password,
    });
    return { focusCertificadoUploadedAt: new Date() };
  },

  validateBeforeIssue({ contract, profile, overrides, environment }) {
    const provider = resolveNfseProvider(profile.nfseStandard);
    return provider.validate(contract, profile, overrides, environment);
  },

  async issueInvoice({ ref, contract, profile, overrides, environment }) {
    const provider = resolveNfseProvider(profile.nfseStandard);
    const companyToken = resolveCompanyToken(profile, environment);
    const { response, payload } = await provider.emitir({
      ref,
      contract,
      profile,
      overrides,
      environment,
      companyToken,
    });
    return {
      ...toInvoiceSnapshot(response),
      invoiceType: provider.invoiceType,
      requestPayload: payload,
    };
  },

  async getInvoice({ invoice, profile }: InvoiceLocator) {
    const provider = resolveNfseProviderByInvoiceType(invoice.type);
    const environment = invoice.environment as FiscalEnvironment;
    const companyToken = resolveCompanyToken(profile, environment);
    const response = await provider.consultar(
      invoice.ref,
      environment,
      companyToken,
    );
    return toInvoiceSnapshot(response);
  },

  async cancelInvoice({ invoice, profile }: InvoiceLocator, justificativa) {
    const provider = resolveNfseProviderByInvoiceType(invoice.type);
    const environment = invoice.environment as FiscalEnvironment;
    const companyToken = resolveCompanyToken(profile, environment);
    await provider.cancelar(
      invoice.ref,
      justificativa,
      environment,
      companyToken,
    );
  },

  async downloadInvoicePdf({ invoice }: InvoiceLocator) {
    if (!invoice.urlDanfse) return null;
    return { kind: "redirect", url: invoice.urlDanfse };
  },

  async downloadInvoiceXml({ invoice }: InvoiceLocator) {
    const xmlUrl = invoice.caminhoXmlStorage ?? invoice.caminhoXmlFocus;
    if (!xmlUrl) return null;
    const xmlResponse = await fetch(xmlUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!xmlResponse.ok) return null;
    return {
      kind: "buffer",
      buffer: Buffer.from(await xmlResponse.arrayBuffer()),
      contentType: "application/xml",
    };
  },
};

registerGateway(focusNfeGateway);
