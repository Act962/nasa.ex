// Sincronização da empresa emissora na NFE.io (CompanyResource v1).
// Fluxo: id conhecido → retrieve+update; senão create → (409 → retrieve por
// CNPJ → update). Certificado (base64 vindo do form) sobe em chamada própria.

import { ConflictError, NotFoundError, type Company } from "nfe-io";
import { getNfeIoClient, uploadNfeIoCertificate } from "@/lib/nfe-io";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import {
  FiscalGatewayValidationError,
  type CompanyProfileDraft,
  type CompanyProfilePatch,
  type CompanySyncInput,
  type CompanySyncResult,
} from "../../types";
import { percentToFraction } from "./build-service-invoice-payload";

const ENVIRONMENT_TO_NFE_IO: Record<FiscalEnvironment, string> = {
  HOMOLOGACAO: "Development",
  PRODUCAO: "Production",
};

// Códigos do regime especial (enum Focus, já usado no perfil) → enum NFE.io.
const SPECIAL_TAX_REGIME_BY_CODE: Record<string, string> = {
  "1": "MicroempresaMunicipal",
  "2": "Estimativa",
  "3": "SociedadeDeProfissionais",
  "4": "Cooperativa",
  "5": "MicroempreendedorIndividual",
  "6": "MicroempresarioEmpresaPequenoPorte",
};

// O SDK tipa taxRegime como union fechada; o valor vem de um <Select> na UI
// (issue-invoice-schema/fiscal-profile-form) restrito às mesmas opções, então
// o cast é seguro — não há entrada livre de usuário aqui.
function resolveTaxRegime(draft: CompanyProfileDraft): Company["taxRegime"] {
  if (draft.taxRegime) return draft.taxRegime as Company["taxRegime"];
  if (draft.simplesNacionalMei) return "MicroempreendedorIndividual";
  if (draft.optanteSimplesNacional) return "SimplesNacional";
  return "LucroPresumido";
}

function buildCompanyPayload(draft: CompanyProfileDraft): Company {
  return {
    name: draft.razaoSocial,
    ...(draft.nomeFantasia ? { tradeName: draft.nomeFantasia } : {}),
    federalTaxNumber: Number(draft.documentoDigits),
    email: draft.email ?? "",
    // "openningDate" com typo duplo é o nome real do campo na API v1.
    ...(draft.openingDate
      ? { openningDate: draft.openingDate.toISOString() }
      : {}),
    taxRegime: resolveTaxRegime(draft),
    specialTaxRegime: draft.regimeEspecialTributacao
      ? (SPECIAL_TAX_REGIME_BY_CODE[draft.regimeEspecialTributacao] ??
        "Automatico")
      : "Automatico",
    ...(draft.legalNature ? { legalNature: draft.legalNature } : {}),
    municipalTaxNumber: draft.inscricaoMunicipal,
    // CNAE não é campo de empresa na NFE.io (o schema de /companies não tem
    // economicActivities — ele mora na inscrição municipal). Enviar aqui é
    // campo desconhecido e provoca 400.
    issRate: percentToFraction(draft.defaultAliquotaIss),
    environment: ENVIRONMENT_TO_NFE_IO[draft.environment],
    address: {
      country: "BRA",
      postalCode: draft.cep.replace(/\D/g, ""),
      street: draft.logradouro,
      number: draft.numero,
      ...(draft.complemento ? { additionalInformation: draft.complemento } : {}),
      district: draft.bairro,
      city: { code: draft.codigoMunicipio, name: draft.municipio },
      state: draft.uf,
    },
  };
}

function companyToPatch(company: Company): CompanyProfilePatch {
  const certificate = company.certificate as
    | { status?: string; expiresOn?: string }
    | undefined;
  return {
    nfeIoCompanyId: company.id ?? null,
    nfeIoFiscalStatus:
      typeof company.fiscalStatus === "string" ? company.fiscalStatus : null,
    nfeIoCertificateStatus: certificate?.status ?? null,
    nfeIoCertificateExpiresOn: certificate?.expiresOn
      ? new Date(certificate.expiresOn)
      : null,
  };
}

export async function syncNfeIoCompany(
  input: CompanySyncInput,
): Promise<CompanySyncResult> {
  const { draft, existingProfile, certificate } = input;

  if (draft.documentoTipo === "cpf") {
    throw new FiscalGatewayValidationError(
      "A NFE.io emite NFS-e apenas para empresas (CNPJ). Prestador pessoa física não é suportado neste gateway.",
    );
  }
  if (!draft.email) {
    throw new FiscalGatewayValidationError(
      "E-mail da empresa é obrigatório para o cadastro na NFE.io.",
    );
  }

  const nfeIo = getNfeIoClient();
  const payload = buildCompanyPayload(draft);

  let company: Company | null = null;

  const knownCompanyId = existingProfile?.nfeIoCompanyId ?? null;
  if (knownCompanyId) {
    try {
      await nfeIo.companies.retrieve(knownCompanyId);
      company = await nfeIo.companies.update(knownCompanyId, payload);
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
      // ID obsoleto — segue para o fluxo de criação/recuperação por CNPJ.
    }
  }

  if (!company) {
    try {
      company = await nfeIo.companies.create(payload);
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      // CNPJ já cadastrado na conta — recupera e atualiza.
      const existingCompany = await nfeIo.companies.retrieve(
        draft.documentoDigits,
      );
      if (!existingCompany.id)
        throw new Error(
          "NFE.io retornou empresa existente sem id ao recuperar por CNPJ.",
        );
      company = await nfeIo.companies.update(existingCompany.id, payload);
    }
  }

  let patch = companyToPatch(company);

  if (certificate && company.id) {
    // Upload direto (ver uploadNfeIoCertificate): o método do SDK usa o campo
    // multipart errado (`certificate` em vez de `file`) e Buffer cru.
    await uploadNfeIoCertificate({
      companyId: company.id,
      fileBase64: certificate.fileBase64,
      password: certificate.password,
      filename: "certificado.pfx",
    });
    try {
      const certificateStatus = await nfeIo.companies.getCertificateStatus(
        company.id,
      );
      patch = {
        ...patch,
        nfeIoCertificateStatus: certificateStatus.hasCertificate
          ? "Active"
          : (patch.nfeIoCertificateStatus ?? null),
        nfeIoCertificateExpiresOn: certificateStatus.expiresOn
          ? new Date(certificateStatus.expiresOn)
          : (patch.nfeIoCertificateExpiresOn ?? null),
      };
    } catch (statusErr) {
      console.error(
        "[fiscal/nfe-io-gateway] getCertificateStatus falhou após upload",
        statusErr,
      );
    }
  }

  return { registered: Boolean(company.id), profilePatch: patch };
}
