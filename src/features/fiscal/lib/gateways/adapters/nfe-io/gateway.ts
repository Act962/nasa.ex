// Adapter NFE.io do port FiscalGatewayAdapter, construído sobre o SDK oficial
// (singleton em src/lib/nfe-io.ts). Correlação de notas: o `ref` interno vai
// no campo externalId do payload; o id da nota na NFE.io fica em
// FiscalInvoice.externalId.

import { NotFoundError, type ServiceInvoiceData } from "nfe-io";
import { getNfeIoClient } from "@/lib/nfe-io";
import type { FiscalCompanyProfile } from "@/generated/prisma/client";
import { registerGateway } from "../../factory";
import { nfeIoFlowStatusToDb } from "../../status-mapping";
import type {
  FiscalGatewayAdapter,
  InvoiceLocator,
  InvoiceSnapshot,
} from "../../types";
import {
  buildNfeIoServiceInvoicePayload,
  validateBeforeEmitNfeIo,
} from "./build-service-invoice-payload";
import { ensureNfeIoAccountWebhook } from "./ensure-account-webhook";
import { syncNfeIoCompany } from "./sync-company";

function requireCompanyId(profile: FiscalCompanyProfile): string {
  if (!profile.nfeIoCompanyId)
    throw new Error(
      "Empresa não está cadastrada na NFE.io. Salve o perfil fiscal novamente.",
    );
  return profile.nfeIoCompanyId;
}

function toInvoiceSnapshot(invoice: ServiceInvoiceData): InvoiceSnapshot {
  const flowStatus = invoice.flowStatus ?? null;
  const status = nfeIoFlowStatusToDb(flowStatus);
  const flowMessage =
    typeof invoice.flowMessage === "string" && invoice.flowMessage
      ? invoice.flowMessage
      : null;
  return {
    status,
    rawStatus: flowStatus ?? "unknown",
    externalId: invoice.id ?? null,
    numero: invoice.number != null ? String(invoice.number) : null,
    codigoVerificacao: invoice.checkCode ?? null,
    // NFE.io não expõe URLs públicas — PDF/XML saem via download autenticado.
    urlEspelho: null,
    urlDanfse: null,
    caminhoXml: null,
    errorMessage:
      status === "ERRO" || flowStatus === "CancelFailed"
        ? (flowMessage ?? "Erro desconhecido")
        : null,
    providerResponse: invoice,
  };
}

// A nota pode ainda não ter id conhecido localmente (emissão 202 sem corpo
// útil) — nesse caso recupera pelo externalId (= ref) enviado na criação.
async function fetchInvoice(locator: InvoiceLocator): Promise<ServiceInvoiceData> {
  const nfeIo = getNfeIoClient();
  const companyId = requireCompanyId(locator.profile);
  if (locator.invoice.externalId) {
    return nfeIo.serviceInvoices.retrieve(companyId, locator.invoice.externalId);
  }
  return nfeIo.serviceInvoices.retrieveByExternalId(
    companyId,
    locator.invoice.ref,
  );
}

export const nfeIoGateway: FiscalGatewayAdapter = {
  id: "NFE_IO",

  syncCompany: syncNfeIoCompany,

  async afterProfileSaved() {
    await ensureNfeIoAccountWebhook();
    return null;
  },

  async getCompanyStatus(profile) {
    if (!profile.nfeIoCompanyId) return null;
    const nfeIo = getNfeIoClient();
    const company = await nfeIo.companies.retrieve(profile.nfeIoCompanyId);
    const certificate = company.certificate as
      | { status?: string; expiresOn?: string }
      | undefined;
    return {
      nfeIoFiscalStatus:
        typeof company.fiscalStatus === "string" ? company.fiscalStatus : null,
      nfeIoCertificateStatus: certificate?.status ?? null,
      nfeIoCertificateExpiresOn: certificate?.expiresOn
        ? new Date(certificate.expiresOn)
        : null,
    };
  },

  async deleteCompany(profile) {
    if (!profile.nfeIoCompanyId) return;
    try {
      await getNfeIoClient().companies.remove(profile.nfeIoCompanyId);
    } catch (err) {
      // Empresa já removida na NFE.io — prossegue com a limpeza local.
      if (!(err instanceof NotFoundError)) throw err;
    }
  },

  async uploadCertificate(profile, certificate) {
    const companyId = requireCompanyId(profile);
    const nfeIo = getNfeIoClient();
    await nfeIo.companies.uploadCertificate(companyId, {
      file: certificate.file,
      password: certificate.password,
      filename: certificate.fileName,
    });
    try {
      const certificateStatus =
        await nfeIo.companies.getCertificateStatus(companyId);
      return {
        nfeIoCertificateStatus: certificateStatus.hasCertificate
          ? "Active"
          : "Pending",
        nfeIoCertificateExpiresOn: certificateStatus.expiresOn
          ? new Date(certificateStatus.expiresOn)
          : null,
      };
    } catch {
      return { nfeIoCertificateStatus: "Pending" };
    }
  },

  validateBeforeIssue({ contract, profile, overrides, environment }) {
    return validateBeforeEmitNfeIo(contract, profile, overrides, environment);
  },

  async issueInvoice({ ref, contract, profile, overrides }) {
    const nfeIo = getNfeIoClient();
    const companyId = requireCompanyId(profile);
    const payload = buildNfeIoServiceInvoicePayload(
      ref,
      contract,
      profile,
      overrides,
    );

    const result = await nfeIo.serviceInvoices.create(
      companyId,
      payload as never,
    );

    if (result.status === "immediate") {
      return {
        ...toInvoiceSnapshot(result.invoice),
        invoiceType: "NFSE" as const,
        requestPayload: payload,
      };
    }

    // 202 assíncrono: a nota entrou na fila. O id externo chega via webhook ou
    // é recuperado depois por retrieveByExternalId(ref).
    return {
      status: "PROCESSANDO" as const,
      rawStatus: "WaitingSend",
      externalId: extractInvoiceIdFromLocation(result.response.location),
      numero: null,
      codigoVerificacao: null,
      urlEspelho: null,
      urlDanfse: null,
      caminhoXml: null,
      errorMessage: null,
      providerResponse: result.response,
      invoiceType: "NFSE" as const,
      requestPayload: payload,
    };
  },

  async getInvoice(locator) {
    return toInvoiceSnapshot(await fetchInvoice(locator));
  },

  async cancelInvoice(locator) {
    const nfeIo = getNfeIoClient();
    const companyId = requireCompanyId(locator.profile);
    const invoiceId =
      locator.invoice.externalId ?? (await fetchInvoice(locator)).id;
    if (!invoiceId)
      throw new Error(
        "Nota não localizada na NFE.io para cancelamento (id externo ausente).",
      );
    await nfeIo.serviceInvoices.cancel(companyId, invoiceId);
  },

  async downloadInvoicePdf(locator) {
    const nfeIo = getNfeIoClient();
    const companyId = requireCompanyId(locator.profile);
    const invoiceId =
      locator.invoice.externalId ?? (await fetchInvoice(locator)).id;
    if (!invoiceId) return null;
    const buffer = await nfeIo.serviceInvoices.downloadPdf(
      companyId,
      invoiceId,
    );
    return { kind: "buffer", buffer, contentType: "application/pdf" };
  },

  async downloadInvoiceXml(locator) {
    const nfeIo = getNfeIoClient();
    const companyId = requireCompanyId(locator.profile);
    const invoiceId =
      locator.invoice.externalId ?? (await fetchInvoice(locator)).id;
    if (!invoiceId) return null;
    const buffer = await nfeIo.serviceInvoices.downloadXml(
      companyId,
      invoiceId,
    );
    return { kind: "buffer", buffer, contentType: "application/xml" };
  },
};

// O Location do 202 termina no id da nota (".../serviceinvoices/{id}").
function extractInvoiceIdFromLocation(
  location: string | undefined,
): string | null {
  if (!location) return null;
  const lastSegment = location.split("?")[0]?.split("/").filter(Boolean).pop();
  return lastSegment && lastSegment !== "serviceinvoices" ? lastSegment : null;
}

registerGateway(nfeIoGateway);
