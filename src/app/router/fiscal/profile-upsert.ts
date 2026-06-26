import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { consultarEmpresa } from "@/http/focus-nfe/consultar-empresa";
import { cadastrarEmpresa } from "@/http/focus-nfe/cadastrar-empresa";
import { atualizarEmpresa } from "@/http/focus-nfe/atualizar-empresa";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import { encryptSecret } from "@/lib/crypto";
import type { FocusEmpresaResponse } from "@/http/focus-nfe/types";

function encryptFocusTokens(empresa: FocusEmpresaResponse): {
  focusTokenProducao: string | null;
  focusTokenHomologacao: string | null;
} {
  try {
    return {
      focusTokenProducao: empresa.token_producao
        ? encryptSecret(empresa.token_producao)
        : null,
      focusTokenHomologacao: empresa.token_homologacao
        ? encryptSecret(empresa.token_homologacao)
        : null,
    };
  } catch (err) {
    console.error("[fiscal/upsert] encryptFocusTokens falhou", err);
    return { focusTokenProducao: null, focusTokenHomologacao: null };
  }
}

const upsertProfileInput = z
  .object({
    documentoTipo: z.enum(["cnpj", "cpf"]),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    razaoSocial: z.string(),
    nomeFantasia: z.string().optional(),
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
    supportedByFocus: z.boolean(),
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
  .output(z.object({ ok: z.boolean(), focusEmpresaRegistered: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const cnpjDigits = input.cnpj?.replace(/\D/g, "");
      const cpfDigits = input.cpf?.replace(/\D/g, "");
      const documentoDigits = cnpjDigits || cpfDigits || "";
      const isCpf = !cnpjDigits && !!cpfDigits;

      const hasCertificado =
        !!input.arquivoCertificadoBase64 && !!input.senhaCertificado;

      // Busca o ID Focus já salvo para não usar CNPJ como identificador
      const existingProfile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
        select: { focusEmpresaId: true },
      });

      let focusEmpresaId: number | null =
        existingProfile?.focusEmpresaId ?? null;
      let focusEmpresaRegistered = false;
      let certWasSent = false;
      let focusTokenProducao: string | null = null;
      let focusTokenHomologacao: string | null = null;

      if (focusEmpresaId !== null) {
        // Empresa já conhecida — confirma existência via ID numérico
        try {
          const empresa = await consultarEmpresa(focusEmpresaId);
          focusEmpresaRegistered = true;
          ({ focusTokenProducao, focusTokenHomologacao } =
            encryptFocusTokens(empresa));

          if (hasCertificado) {
            try {
              const updated = await atualizarEmpresa(focusEmpresaId, {
                arquivo_certificado_base64: input.arquivoCertificadoBase64,
                senha_certificado: input.senhaCertificado,
              });
              certWasSent = true;
              ({ focusTokenProducao, focusTokenHomologacao } =
                encryptFocusTokens(updated));
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
            // ID ficou obsoleto — trata como nova empresa
            focusEmpresaId = null;
          } else {
            throw err;
          }
        }
      }

      if (focusEmpresaId === null) {
        // Empresa não existe na Focus — cadastrar
        try {
          const inscricaoMunicipalInt = parseInt(input.inscricaoMunicipal);
          const created = await cadastrarEmpresa({
            ...(isCpf ? { cpf: cpfDigits } : { cnpj: cnpjDigits }),
            nome: input.razaoSocial,
            nome_fantasia: input.nomeFantasia || undefined,
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
                  arquivo_certificado_base64: input.arquivoCertificadoBase64,
                  senha_certificado: input.senhaCertificado,
                }
              : {}),
          });
          focusEmpresaId = created.id;
          focusEmpresaRegistered = true;
          if (hasCertificado) certWasSent = true;
          ({ focusTokenProducao, focusTokenHomologacao } =
            encryptFocusTokens(created));
        } catch (cadastroErr) {
          console.error("[fiscal/upsert] cadastrarEmpresa falhou", {
            status:
              cadastroErr instanceof FocusNfeHttpError
                ? cadastroErr.status
                : null,
            code:
              cadastroErr instanceof FocusNfeHttpError
                ? cadastroErr.code
                : null,
            message:
              cadastroErr instanceof Error ? cadastroErr.message : cadastroErr,
            bodySnippet:
              cadastroErr instanceof FocusNfeHttpError
                ? cadastroErr.bodySnippet
                : null,
            payloadEnviado: {
              ...(isCpf ? { cpf: cpfDigits } : { cnpj: cnpjDigits }),
              nome: input.razaoSocial,
              municipio: input.municipio,
              codigoMunicipio: input.codigoMunicipio,
              uf: input.uf,
              cep: input.cep,
              environment: "PRODUCAO",
            },
          });
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
          environment: "PRODUCAO",
          focusEmpresaRegistered,
          ...(focusEmpresaId !== null ? { focusEmpresaId } : {}),
          ...(focusTokenProducao !== null ? { focusTokenProducao } : {}),
          ...(focusTokenHomologacao !== null ? { focusTokenHomologacao } : {}),
          ...(certWasSent ? { focusCertificadoUploadedAt: new Date() } : {}),
        },
        update: {
          ...profileData,
          cnpj: documentoDigits,
          environment: "PRODUCAO",
          focusEmpresaRegistered,
          ...(focusEmpresaId !== null ? { focusEmpresaId } : {}),
          ...(focusTokenProducao !== null ? { focusTokenProducao } : {}),
          ...(focusTokenHomologacao !== null ? { focusTokenHomologacao } : {}),
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
      console.error("[fiscal/upsert] erro inesperado", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
