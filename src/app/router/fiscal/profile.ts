import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { consultarEmpresa } from "@/http/focus-nfe/consultar-empresa";
import { cadastrarEmpresa } from "@/http/focus-nfe/cadastrar-empresa";
import { atualizarEmpresa } from "@/http/focus-nfe/atualizar-empresa";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";

export const fiscalProfileGet = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get fiscal profile", tags: ["Fiscal"] })
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    try {
      const profile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
      });
      return {
        profile: profile
          ? {
              ...profile,
              defaultAliquotaIss: profile.defaultAliquotaIss.toString(),
            }
          : null,
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

const upsertProfileInput = z
  .object({
    documentoTipo: z.enum(["cnpj", "cpf"]),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    razaoSocial: z.string(),
    municipio: z.string(),
    inscricaoMunicipal: z.string(),
    codigoMunicipio: z
      .string()
      .regex(/^\d{7}$/, "Código IBGE deve ter 7 dígitos"),
    optanteSimplesNacional: z.boolean(),
    regimeEspecialTributacao: z.string().nullable().optional(),
    logradouro: z.string(),
    numero: z.string(),
    complemento: z.string().optional(),
    bairro: z.string(),
    cep: z.string(),
    uf: z.string().length(2),
    defaultItemListaServico: z.string(),
    defaultAliquotaIss: z.string(),
    defaultIssRetido: z.boolean(),
    defaultDiscriminacao: z.string().optional(),
    environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
    supportedByFocus: z.boolean(),
    arquivoCertificadoBase64: z.string(),
    senhaCertificado: z.string(),
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
  .output(z.object({ ok: z.boolean(), focusEmpresaRegistered: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const environment = input.environment as FiscalEnvironment;

      const cnpjDigits = input.cnpj?.replace(/\D/g, "");
      const cpfDigits = input.cpf?.replace(/\D/g, "");
      const documentoDigits = cnpjDigits ?? cpfDigits ?? "";
      const isCpf = !cnpjDigits && !!cpfDigits;

      const hasCertificado =
        !!input.arquivoCertificadoBase64 && !!input.senhaCertificado;

      let focusEmpresaRegistered = false;
      let certWasSent = false;

      try {
        await consultarEmpresa(documentoDigits, environment);
        focusEmpresaRegistered = true;

        if (hasCertificado) {
          try {
            await atualizarEmpresa(
              documentoDigits,
              {
                arquivo_certificado_base64: input.arquivoCertificadoBase64,
                senha_certificado: input.senhaCertificado,
              },
              environment,
            );
            certWasSent = true;
          } catch (certErr) {
            console.error("[fiscal/upsert] atualizarEmpresa cert falhou", {
              status:
                certErr instanceof FocusNfeHttpError ? certErr.status : null,
              message: certErr instanceof Error ? certErr.message : certErr,
            });
          }
        }
      } catch (err) {
        if (err instanceof FocusNfeHttpError && err.status === 404) {
          try {
            const inscricaoMunicipalInt = parseInt(input.inscricaoMunicipal);
            await cadastrarEmpresa(
              {
                ...(isCpf ? { cpf: cpfDigits } : { cnpj: cnpjDigits }),
                nome: input.razaoSocial,
                inscricao_municipal: !isNaN(inscricaoMunicipalInt)
                  ? inscricaoMunicipalInt
                  : undefined,
                regime_tributario: input.optanteSimplesNacional ? 1 : 3,
                logradouro: input.logradouro,
                numero: parseInt(input.numero),
                complemento: input.complemento || undefined,
                municipio: input.municipio ?? "",
                bairro: input.bairro,
                cep: parseInt(input.cep.replace(/\D/g, "")),
                uf: input.uf,
                habilita_nfse: true,
                ...(hasCertificado
                  ? {
                      arquivo_certificado_base64:
                        input.arquivoCertificadoBase64,
                      senha_certificado: input.senhaCertificado,
                    }
                  : {}),
              },
              environment,
            );
            focusEmpresaRegistered = true;
            if (hasCertificado) certWasSent = true;
          } catch (cadastroErr) {
            console.error("[fiscal/upsert] cadastrarEmpresa falhou", {
              status:
                cadastroErr instanceof FocusNfeHttpError
                  ? cadastroErr.status
                  : null,
              message:
                cadastroErr instanceof Error
                  ? cadastroErr.message
                  : cadastroErr,
            });
          }
        } else {
          throw err;
        }
      }

      const {
        arquivoCertificadoBase64: _cert,
        senhaCertificado: _senha,
        documentoTipo: _tipo,
        cnpj: _cnpj,
        cpf: _cpf,
        ...profileData
      } = input;

      await prisma.fiscalCompanyProfile.upsert({
        where: { organizationId: context.org.id },
        create: {
          organizationId: context.org.id,
          ...profileData,
          cnpj: documentoDigits,
          focusEmpresaRegistered,
          ...(certWasSent ? { focusCertificadoUploadedAt: new Date() } : {}),
        },
        update: {
          ...profileData,
          cnpj: documentoDigits,
          focusEmpresaRegistered,
          ...(certWasSent ? { focusCertificadoUploadedAt: new Date() } : {}),
        },
      });

      return { ok: true, focusEmpresaRegistered };
    } catch (err) {
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
      console.log(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
