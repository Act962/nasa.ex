import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NfeError } from "nfe-io";
import {
  NfeIoCertificateUploadError,
  describeNfeIoError,
} from "@/lib/nfe-io";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import {
  FiscalGatewayValidationError,
  resolveGateway,
  type CompanySyncInput,
} from "@/features/fiscal/lib/gateways";
import type { FiscalEnvironment } from "@/generated/prisma/enums";

const upsertProfileInput = z
  .object({
    documentoTipo: z.enum(["cnpj", "cpf"]),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    razaoSocial: z.string(),
    nomeFantasia: z.string().optional(),
    email: z.string().email("E-mail da empresa inválido").optional(),
    openingDate: z.string().optional(),
    legalNature: z.string().optional(),
    taxRegime: z.string().optional(),
    municipio: z.string(),
    inscricaoMunicipal: z.string(),
    codigoMunicipio: z
      .string()
      .regex(/^\d{7}$/, "Código IBGE deve ter 7 dígitos"),
    optanteSimplesNacional: z.boolean(),
    simplesNacionalMei: z.boolean().optional(),
    regimeEspecialTributacao: z.string().nullable().optional(),
    environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]).optional(),
    logradouro: z.string(),
    numero: z.string(),
    complemento: z.string().optional(),
    bairro: z.string(),
    cep: z.string(),
    uf: z.string().length(2),
    defaultItemListaServico: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(
        z
          .string()
          .regex(
            /^\d{6}$/,
            "Item da lista de serviço deve ter 6 dígitos numéricos (2 para item, 2 para subitem e 2 para desdobro nacional)",
          ),
      ),
    defaultCityServiceCode: z.string().optional(),
    defaultAliquotaIss: z.string(),
    defaultIssRetido: z.boolean(),
    defaultTributacaoIssqn: z.number().int().min(1).max(4).default(1),
    defaultDiscriminacao: z.string().optional(),
    defaultCodigoCnae: z
      .string()
      .regex(/^\d{7}$|^\d{9}$/, "CNAE deve ter 7 ou 9 dígitos numéricos")
      .nullable()
      .optional(),
    defaultCodigoTributarioMunicipio: z.string().nullable().optional(),
    ibsCbsSituacaoTributaria: z
      .string()
      .regex(/^\d{1,3}$/, "CST IBS/CBS deve ter 1 a 3 dígitos")
      .nullable()
      .optional(),
    ibsCbsClassificacaoTributaria: z
      .string()
      .regex(/^\d{6}$/, "Classificação tributária deve ter 6 dígitos")
      .nullable()
      .optional(),
    defaultConsumidorFinal: z.boolean().optional(),
    // Padrões financeiros percentuais (0–100). Persistidos como Decimal via spread.
    defaultIrPercent: z.coerce.number().min(0).max(100).optional(),
    defaultPisPercent: z.coerce.number().min(0).max(100).optional(),
    defaultCofinsPercent: z.coerce.number().min(0).max(100).optional(),
    defaultCsllPercent: z.coerce.number().min(0).max(100).optional(),
    defaultInssPercent: z.coerce.number().min(0).max(100).optional(),
    defaultOutrasRetencoesPercent: z.coerce.number().min(0).max(100).optional(),
    defaultDeducoesPercent: z.coerce.number().min(0).max(100).optional(),
    defaultDescontoIncondicionadoPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional(),
    defaultDescontoCondicionadoPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional(),
    defaultInformacoesAdicionais: z.string().nullable().optional(),
    autoIssueOnEntryPaid: z.boolean().optional(),
    supportedByFocus: z.boolean(),
    nfseStandard: z.enum(["MUNICIPAL", "NACIONAL"]).optional(),
    arquivoCertificadoBase64: z.string().optional(),
    senhaCertificado: z.string().optional(),
  })
  .refine((data) => !!data.cnpj || !!data.cpf, {
    message: "CNPJ ou CPF obrigatório",
    path: ["cnpj"],
  });

export const fiscalProfileUpsert = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Upsert fiscal profile", tags: ["Fiscal"] })
  .input(upsertProfileInput)
  .output(
    z.object({
      ok: z.boolean(),
      companyRegistered: z.boolean(),
      focusEmpresaRegistered: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const cnpjDigits = input.cnpj?.replace(/\D/g, "");
      const cpfDigits = input.cpf?.replace(/\D/g, "");
      const documentoDigits = cnpjDigits || cpfDigits || "";
      const isCpf = !cnpjDigits && !!cpfDigits;

      const existingProfile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
      });

      const environment: FiscalEnvironment =
        input.environment ?? existingProfile?.environment ?? "HOMOLOGACAO";

      // Decisão do produto: toda empresa gerida pelo Forge emite via NFE.io.
      // O adapter Focus segue registrado para notas antigas (consultar/cancelar)
      // e perfis legados ainda não re-salvos.
      const gateway = resolveGateway("NFE_IO");

      const syncInput: CompanySyncInput = {
        organizationId: context.org.id,
        existingProfile,
        certificate:
          input.arquivoCertificadoBase64 && input.senhaCertificado
            ? {
                fileBase64: input.arquivoCertificadoBase64,
                password: input.senhaCertificado,
              }
            : null,
        draft: {
          documentoTipo: isCpf ? "cpf" : "cnpj",
          documentoDigits,
          razaoSocial: input.razaoSocial,
          nomeFantasia: input.nomeFantasia ?? null,
          email: input.email ?? null,
          openingDate: input.openingDate ? new Date(input.openingDate) : null,
          legalNature: input.legalNature ?? null,
          taxRegime: input.taxRegime ?? null,
          municipio: input.municipio,
          codigoMunicipio: input.codigoMunicipio,
          inscricaoMunicipal: input.inscricaoMunicipal,
          optanteSimplesNacional: input.optanteSimplesNacional,
          simplesNacionalMei: input.simplesNacionalMei ?? false,
          regimeEspecialTributacao: input.regimeEspecialTributacao ?? null,
          nfseStandardPreference: input.nfseStandard ?? null,
          supportedByFocusFromClient: input.supportedByFocus,
          logradouro: input.logradouro,
          numero: input.numero,
          complemento: input.complemento ?? null,
          bairro: input.bairro,
          cep: input.cep,
          uf: input.uf,
          defaultAliquotaIss: Number(input.defaultAliquotaIss),
          defaultCodigoCnae: input.defaultCodigoCnae ?? null,
          environment,
        },
      };

      const syncResult = await gateway.syncCompany(syncInput);

      const {
        arquivoCertificadoBase64: _cert,
        senhaCertificado: _senha,
        documentoTipo: _tipo,
        cnpj: _cnpj,
        cpf: _cpf,
        supportedByFocus: _supportedByFocusFromClient,
        nfseStandard: inputNfseStandard,
        openingDate: inputOpeningDate,
        environment: _environmentInput,
        ...profileData
      } = input;

      const savedProfile = await prisma.fiscalCompanyProfile.upsert({
        where: { organizationId: context.org.id },
        create: {
          organizationId: context.org.id,
          ...profileData,
          cnpj: documentoDigits,
          fiscalGateway: gateway.id,
          environment,
          openingDate: inputOpeningDate ? new Date(inputOpeningDate) : null,
          ...(inputNfseStandard ? { nfseStandard: inputNfseStandard } : {}),
          ...syncResult.profilePatch,
        },
        update: {
          ...profileData,
          cnpj: documentoDigits,
          fiscalGateway: gateway.id,
          environment,
          openingDate: inputOpeningDate ? new Date(inputOpeningDate) : null,
          ...(inputNfseStandard ? { nfseStandard: inputNfseStandard } : {}),
          ...syncResult.profilePatch,
        },
      });

      const postSavePatch = await gateway.afterProfileSaved(
        savedProfile,
        syncInput,
      );
      if (postSavePatch && Object.keys(postSavePatch).length > 0) {
        await prisma.fiscalCompanyProfile.update({
          where: { id: savedProfile.id },
          data: postSavePatch,
        });
      }

      return {
        ok: true,
        companyRegistered: syncResult.registered,
        focusEmpresaRegistered: syncResult.registered,
      };
    } catch (err) {
      // Erros oRPC intencionais passam direto, sem virar INTERNAL_SERVER_ERROR.
      if (err instanceof Error && err.name === "ORPCError") throw err;
      if (err instanceof FiscalGatewayValidationError) {
        throw errors.BAD_REQUEST({ message: err.message });
      }
      if (err instanceof NfeIoCertificateUploadError) {
        console.error("[fiscal/upsert] NfeIoCertificateUploadError", {
          status: err.status,
          details: err.details,
        });
        const certDetail = describeNfeIoError(err.details);
        throw errors.BAD_REQUEST({
          message: `Erro ao enviar o certificado para a NFE.io${
            certDetail ? `: ${certDetail}` : "."
          }`,
        });
      }
      if (err instanceof NfeError) {
        console.error("[fiscal/upsert] NfeError", {
          type: err.type,
          name: err.name,
          status: err.status,
          code: err.code,
          message: err.message,
          details: err.details,
          raw: err.raw,
        });
        const nfeDetail = describeNfeIoError(err.details ?? err.raw);
        throw errors.BAD_REQUEST({
          message: `Erro ao sincronizar empresa na NFE.io: ${err.message}${
            nfeDetail ? ` — ${nfeDetail}` : ""
          }`,
        });
      }
      if (err instanceof FocusNfeHttpError) {
        console.error("[fiscal/upsert] FocusNfeHttpError", {
          status: err.status,
          code: err.code,
          message: err.message,
          body: err.bodySnippet,
        });
        throw errors.BAD_REQUEST({
          message: `Erro ao verificar empresa na Focus: ${err.message}`,
        });
      }
      console.error("[fiscal/upsert] erro inesperado", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
