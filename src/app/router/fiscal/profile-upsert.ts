import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { consultarEmpresa } from "@/http/focus-nfe/consultar-empresa";
import { cadastrarEmpresa } from "@/http/focus-nfe/cadastrar-empresa";
import { atualizarEmpresa } from "@/http/focus-nfe/atualizar-empresa";
import { buscarEmpresasPorCnpj } from "@/http/focus-nfe/buscar-empresa-por-cnpj";
import { listarMunicipios } from "@/http/focus-nfe/listar-municipios";
import { registrarWebhook } from "@/http/focus-nfe/registrar-webhook";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
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
        select: {
          focusEmpresaId: true,
          focusWebhookIdProducao: true,
          focusWebhookIdHomologacao: true,
        },
      });

      let focusEmpresaId: number | null =
        existingProfile?.focusEmpresaId ?? null;
      let focusEmpresaRegistered = false;
      let certWasSent = false;
      let focusTokenProducao: string | null = null;
      let focusTokenHomologacao: string | null = null;

      // Verifica habilita_nfse direto na Focus NFe — não confia no valor enviado pelo cliente
      let supportedByFocus = false;
      try {
        const municipios = await listarMunicipios(
          { nome: input.municipio, uf: input.uf },
          "PRODUCAO",
        );
        const municipio = municipios.find(
          (m) => m.codigo_ibge === input.codigoMunicipio,
        );
        supportedByFocus = municipio?.habilita_nfse ?? false;
      } catch {
        supportedByFocus = input.supportedByFocus;
      }

      if (focusEmpresaId !== null) {
        // Empresa já conhecida — confirma existência e verifica se município ainda bate
        try {
          const empresa = await consultarEmpresa(focusEmpresaId);
          const empresaMunicipio = String(
            (empresa as Record<string, unknown>).codigo_municipio ?? "",
          );

          if (empresaMunicipio && empresaMunicipio !== input.codigoMunicipio) {
            // Município mudou — precisa buscar/criar empresa para o novo município
            focusEmpresaId = null;
          } else {
            focusEmpresaRegistered = true;
            ({ focusTokenProducao, focusTokenHomologacao } =
              encryptFocusTokens(empresa));

            const updatePayload: Record<string, unknown> = { habilita_nfse: true };
            if (hasCertificado) {
              updatePayload.arquivo_certificado_base64 =
                input.arquivoCertificadoBase64;
              updatePayload.senha_certificado = input.senhaCertificado;
            }
            try {
              const updated = await atualizarEmpresa(focusEmpresaId, updatePayload);
              if (hasCertificado) certWasSent = true;
              ({ focusTokenProducao, focusTokenHomologacao } =
                encryptFocusTokens(updated));
            } catch (updateErr) {
              console.error("[fiscal/upsert] atualizarEmpresa known falhou", {
                focusEmpresaId,
                message:
                  updateErr instanceof Error ? updateErr.message : updateErr,
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
        // Busca empresa já cadastrada para este CNPJ E município
        try {
          const todasEmpresas = cnpjDigits
            ? await buscarEmpresasPorCnpj(cnpjDigits)
            : [];

          const empresaExistente =
            todasEmpresas.find(
              (empresa) =>
                String(
                  (empresa as Record<string, unknown>).codigo_municipio ?? "",
                ) === input.codigoMunicipio,
            ) ?? null;

          if (empresaExistente) {
            focusEmpresaId = empresaExistente.id;
            focusEmpresaRegistered = true;
            ({ focusTokenProducao, focusTokenHomologacao } =
              encryptFocusTokens(empresaExistente));

            const updatePayload: Record<string, unknown> = { habilita_nfse: true };
            if (hasCertificado) {
              updatePayload.arquivo_certificado_base64 =
                input.arquivoCertificadoBase64;
              updatePayload.senha_certificado = input.senhaCertificado;
            }
            try {
              const updated = await atualizarEmpresa(focusEmpresaId, updatePayload);
              if (hasCertificado) certWasSent = true;
              ({ focusTokenProducao, focusTokenHomologacao } =
                encryptFocusTokens(updated));
            } catch (updateErr) {
              console.error("[fiscal/upsert] atualizarEmpresa existente falhou", {
                focusEmpresaId,
                message:
                  updateErr instanceof Error ? updateErr.message : updateErr,
              });
            }
          } else {
            // Nenhuma empresa para este CNPJ + município — cadastrar
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
          }
        } catch (cadastroErr) {
          console.error(
            "[fiscal/upsert] erro ao cadastrar/buscar empresa Focus NFe",
            {
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
            },
          );
        }
      }

      const {
        arquivoCertificadoBase64: _cert,
        senhaCertificado: _senha,
        documentoTipo: _tipo,
        cnpj: _cnpj,
        cpf: _cpf,
        supportedByFocus: _supportedByFocusFromClient,
        ...profileData
      } = input;

      const savedProfile = await prisma.fiscalCompanyProfile.upsert({
        where: { organizationId: context.org.id },
        create: {
          organizationId: context.org.id,
          ...profileData,
          cnpj: documentoDigits,
          supportedByFocus,
          focusEmpresaRegistered,
          ...(focusEmpresaId !== null ? { focusEmpresaId } : {}),
          ...(focusTokenProducao !== null ? { focusTokenProducao } : {}),
          ...(focusTokenHomologacao !== null ? { focusTokenHomologacao } : {}),
          ...(certWasSent ? { focusCertificadoUploadedAt: new Date() } : {}),
        },
        update: {
          ...profileData,
          cnpj: documentoDigits,
          supportedByFocus,
          focusEmpresaRegistered,
          ...(focusEmpresaId !== null ? { focusEmpresaId } : {}),
          ...(focusTokenProducao !== null ? { focusTokenProducao } : {}),
          ...(focusTokenHomologacao !== null ? { focusTokenHomologacao } : {}),
          ...(certWasSent ? { focusCertificadoUploadedAt: new Date() } : {}),
        },
      });

      const needsProducaoHook =
        focusEmpresaRegistered && !existingProfile?.focusWebhookIdProducao;
      const needsHomologacaoHook =
        focusEmpresaRegistered && !existingProfile?.focusWebhookIdHomologacao;

      if (needsProducaoHook || needsHomologacaoHook) {
        const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const webhookSecret = process.env.FOCUS_NFE_WEBHOOK_SECRET;
        const webhookUrl = `${webhookBaseUrl}/api/focus-nfe/webhook?fiscalCompanyId=${savedProfile.id}${webhookSecret ? `&secret-key=${encodeURIComponent(webhookSecret)}` : ""}`;

        const registration = {
          event: "nfse" as const,
          url: webhookUrl,
          ...(cnpjDigits ? { cnpj: cnpjDigits } : { cpf: cpfDigits }),
        };

        // Gatilho é operação por-empresa na Focus — usa sempre o token da empresa,
        // nunca o token master (esse é só pra CRUD de /empresas).
        const producaoCompanyToken =
          needsProducaoHook && focusTokenProducao
            ? decryptSecret(focusTokenProducao)
            : null;
        const homologacaoCompanyToken =
          needsHomologacaoHook && focusTokenHomologacao
            ? decryptSecret(focusTokenHomologacao)
            : null;

        if (needsProducaoHook && !producaoCompanyToken) {
          console.error(
            "[fiscal/upsert] registrarWebhook (PRODUCAO) pulado — token da empresa ausente",
          );
        }
        if (needsHomologacaoHook && !homologacaoCompanyToken) {
          console.error(
            "[fiscal/upsert] registrarWebhook (HOMOLOGACAO) pulado — token da empresa ausente",
          );
        }

        const [producaoResult, homologacaoResult] = await Promise.allSettled([
          producaoCompanyToken
            ? registrarWebhook(registration, "PRODUCAO", producaoCompanyToken)
            : Promise.resolve(null),
          homologacaoCompanyToken
            ? registrarWebhook(
                registration,
                "HOMOLOGACAO",
                homologacaoCompanyToken,
              )
            : Promise.resolve(null),
        ]);

        const webhookUpdate: Record<string, string> = {};

        if (producaoResult.status === "fulfilled" && producaoResult.value) {
          webhookUpdate.focusWebhookIdProducao = producaoResult.value.id;
        } else if (producaoResult.status === "rejected") {
          console.error("[fiscal/upsert] registrarWebhook (PRODUCAO) falhou", {
            message:
              producaoResult.reason instanceof Error
                ? producaoResult.reason.message
                : producaoResult.reason,
          });
        }

        if (homologacaoResult.status === "fulfilled" && homologacaoResult.value) {
          webhookUpdate.focusWebhookIdHomologacao = homologacaoResult.value.id;
        } else if (homologacaoResult.status === "rejected") {
          console.error(
            "[fiscal/upsert] registrarWebhook (HOMOLOGACAO) falhou",
            {
              message:
                homologacaoResult.reason instanceof Error
                  ? homologacaoResult.reason.message
                  : homologacaoResult.reason,
            },
          );
        }

        if (Object.keys(webhookUpdate).length > 0) {
          await prisma.fiscalCompanyProfile.update({
            where: { id: savedProfile.id },
            data: webhookUpdate,
          });
        }
      }

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
