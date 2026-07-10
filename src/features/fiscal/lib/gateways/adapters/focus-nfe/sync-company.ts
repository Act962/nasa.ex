// Sincronização de empresa na Focus NFe — lógica extraída de
// src/app/router/fiscal/profile-upsert.ts quando o upsert passou a delegar no
// gateway resolvido. Mantida íntegra para perfis legados e uso futuro.

import { consultarEmpresa } from "@/http/focus-nfe/consultar-empresa";
import { cadastrarEmpresa } from "@/http/focus-nfe/cadastrar-empresa";
import { atualizarEmpresa } from "@/http/focus-nfe/atualizar-empresa";
import { buscarEmpresasPorCnpj } from "@/http/focus-nfe/buscar-empresa-por-cnpj";
import { listarMunicipios } from "@/http/focus-nfe/listar-municipios";
import { registrarWebhook } from "@/http/focus-nfe/registrar-webhook";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { FocusEmpresaResponse } from "@/http/focus-nfe/types";
import type { NfseStandard } from "@/generated/prisma/enums";
import type { FiscalCompanyProfile } from "@/generated/prisma/client";
import { resolveNfseProvider } from "../../../providers/resolve-nfse-provider";
import {
  FiscalGatewayValidationError,
  type CompanyProfilePatch,
  type CompanySyncInput,
  type CompanySyncResult,
} from "../../types";

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
    console.error("[fiscal/focus-gateway] encryptFocusTokens falhou", err);
    return { focusTokenProducao: null, focusTokenHomologacao: null };
  }
}

export async function syncFocusCompany(
  input: CompanySyncInput,
): Promise<CompanySyncResult> {
  const { draft, existingProfile, certificate } = input;
  const isCpf = draft.documentoTipo === "cpf";
  const cnpjDigits = isCpf ? undefined : draft.documentoDigits;
  const cpfDigits = isCpf ? draft.documentoDigits : undefined;
  const hasCertificado = certificate !== null;

  let focusEmpresaId: number | null = existingProfile?.focusEmpresaId ?? null;
  let focusEmpresaRegistered = false;
  let certWasSent = false;
  let focusTokenProducao: string | null = null;
  let focusTokenHomologacao: string | null = null;

  // Verifica habilita_nfse direto na Focus NFe — não confia no valor enviado pelo cliente
  let supportedByFocus = false;
  try {
    const municipios = await listarMunicipios(
      { nome: draft.municipio, uf: draft.uf },
      "PRODUCAO",
    );
    const municipio = municipios.find(
      (candidate) => candidate.codigo_ibge === draft.codigoMunicipio,
    );
    supportedByFocus = municipio?.habilita_nfse ?? false;
  } catch {
    supportedByFocus = draft.supportedByFocusFromClient;
  }

  // Município é a autoridade: a Focus reportando ausência de NFS-e municipal
  // é restrição dura — o usuário não pode forçar MUNICIPAL num município que
  // já migrou para o padrão nacional (a emissão falharia na prefeitura).
  if (draft.nfseStandardPreference === "MUNICIPAL" && !supportedByFocus) {
    throw new FiscalGatewayValidationError(
      "Este município já migrou para o padrão NFS-e Nacional. Não é possível selecionar o padrão municipal.",
    );
  }

  const nfseStandard: NfseStandard =
    draft.nfseStandardPreference ?? (supportedByFocus ? "MUNICIPAL" : "NACIONAL");
  // Focus rejeita habilita_nfse e habilita_nfsen_* ligados juntos — os padrões
  // são mutuamente exclusivos. Sempre desligamos o lado oposto explicitamente.
  const habilitacoesFocus: Record<string, boolean> =
    nfseStandard === "NACIONAL"
      ? {
          habilita_nfsen_producao: true,
          habilita_nfsen_homologacao: true,
          habilita_nfse: false,
        }
      : {
          habilita_nfse: true,
          habilita_nfsen_producao: false,
          habilita_nfsen_homologacao: false,
        };

  const certificadoPayload = hasCertificado
    ? {
        arquivo_certificado_base64: certificate.fileBase64,
        senha_certificado: certificate.password,
      }
    : {};

  if (focusEmpresaId !== null) {
    // Empresa já conhecida — confirma existência e verifica se município ainda bate
    try {
      const empresa = await consultarEmpresa(focusEmpresaId);
      const empresaMunicipio = String(
        (empresa as Record<string, unknown>).codigo_municipio ?? "",
      );

      if (empresaMunicipio && empresaMunicipio !== draft.codigoMunicipio) {
        // Município mudou — precisa buscar/criar empresa para o novo município
        focusEmpresaId = null;
      } else {
        focusEmpresaRegistered = true;
        ({ focusTokenProducao, focusTokenHomologacao } =
          encryptFocusTokens(empresa));

        try {
          const updated = await atualizarEmpresa(focusEmpresaId, {
            ...habilitacoesFocus,
            ...certificadoPayload,
          });
          if (hasCertificado) certWasSent = true;
          ({ focusTokenProducao, focusTokenHomologacao } =
            encryptFocusTokens(updated));
        } catch (updateErr) {
          console.error("[fiscal/focus-gateway] atualizarEmpresa known falhou", {
            focusEmpresaId,
            message: updateErr instanceof Error ? updateErr.message : updateErr,
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
            ) === draft.codigoMunicipio,
        ) ?? null;

      if (empresaExistente) {
        focusEmpresaId = empresaExistente.id;
        focusEmpresaRegistered = true;
        ({ focusTokenProducao, focusTokenHomologacao } =
          encryptFocusTokens(empresaExistente));

        try {
          const updated = await atualizarEmpresa(focusEmpresaId, {
            ...habilitacoesFocus,
            ...certificadoPayload,
          });
          if (hasCertificado) certWasSent = true;
          ({ focusTokenProducao, focusTokenHomologacao } =
            encryptFocusTokens(updated));
        } catch (updateErr) {
          console.error(
            "[fiscal/focus-gateway] atualizarEmpresa existente falhou",
            {
              focusEmpresaId,
              message:
                updateErr instanceof Error ? updateErr.message : updateErr,
            },
          );
        }
      } else {
        // Nenhuma empresa para este CNPJ + município — cadastrar
        const inscricaoMunicipalInt = parseInt(draft.inscricaoMunicipal);
        const created = await cadastrarEmpresa({
          ...(isCpf ? { cpf: cpfDigits } : { cnpj: cnpjDigits }),
          nome: draft.razaoSocial,
          nome_fantasia: draft.nomeFantasia || undefined,
          inscricao_municipal: !isNaN(inscricaoMunicipalInt)
            ? inscricaoMunicipalInt
            : undefined,
          regime_tributario: draft.optanteSimplesNacional ? 1 : 3,
          logradouro: draft.logradouro,
          numero: parseInt(draft.numero),
          complemento: draft.complemento || undefined,
          municipio: draft.municipio ?? "",
          bairro: draft.bairro,
          cep: parseInt(draft.cep.replace(/\D/g, "")),
          uf: draft.uf,
          ...habilitacoesFocus,
          ...certificadoPayload,
        });
        focusEmpresaId = created.id;
        focusEmpresaRegistered = true;
        if (hasCertificado) certWasSent = true;
        ({ focusTokenProducao, focusTokenHomologacao } =
          encryptFocusTokens(created));
      }
    } catch (cadastroErr) {
      console.error(
        "[fiscal/focus-gateway] erro ao cadastrar/buscar empresa Focus NFe",
        {
          status:
            cadastroErr instanceof FocusNfeHttpError ? cadastroErr.status : null,
          code:
            cadastroErr instanceof FocusNfeHttpError ? cadastroErr.code : null,
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

  return {
    registered: focusEmpresaRegistered,
    profilePatch: {
      supportedByFocus,
      nfseStandard,
      focusEmpresaRegistered,
      ...(focusEmpresaId !== null ? { focusEmpresaId } : {}),
      ...(focusTokenProducao !== null ? { focusTokenProducao } : {}),
      ...(focusTokenHomologacao !== null ? { focusTokenHomologacao } : {}),
      ...(certWasSent ? { focusCertificadoUploadedAt: new Date() } : {}),
    },
  };
}

// Registro dos gatilhos de webhook por empresa na Focus — depende do id do
// perfil persistido (compõe a URL do callback), por isso roda pós-upsert.
export async function registerFocusWebhooks(
  profile: FiscalCompanyProfile,
  input: CompanySyncInput,
): Promise<CompanyProfilePatch | null> {
  if (!profile.focusEmpresaRegistered) return null;

  const provider = resolveNfseProvider(profile.nfseStandard);
  const isNacionalHook = provider.webhookEvent === "nfsen";
  const producaoHookField = isNacionalHook
    ? "focusWebhookIdNfsenProducao"
    : "focusWebhookIdProducao";
  const homologacaoHookField = isNacionalHook
    ? "focusWebhookIdNfsenHomologacao"
    : "focusWebhookIdHomologacao";

  const needsProducaoHook = !profile[producaoHookField];
  const needsHomologacaoHook = !profile[homologacaoHookField];
  if (!needsProducaoHook && !needsHomologacaoHook) return null;

  const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookSecret = process.env.FOCUS_NFE_WEBHOOK_SECRET;
  const webhookUrl = `${webhookBaseUrl}/api/focus-nfe/webhook?fiscalCompanyId=${profile.id}${webhookSecret ? `&secret-key=${encodeURIComponent(webhookSecret)}` : ""}`;

  const isCpf = input.draft.documentoTipo === "cpf";
  const registration = {
    event: provider.webhookEvent,
    url: webhookUrl,
    ...(isCpf
      ? { cpf: input.draft.documentoDigits }
      : { cnpj: input.draft.documentoDigits }),
  };

  // Gatilho é operação por-empresa na Focus — usa sempre o token da empresa,
  // nunca o token master (esse é só pra CRUD de /empresas).
  const producaoCompanyToken =
    needsProducaoHook && profile.focusTokenProducao
      ? decryptSecret(profile.focusTokenProducao)
      : null;
  const homologacaoCompanyToken =
    needsHomologacaoHook && profile.focusTokenHomologacao
      ? decryptSecret(profile.focusTokenHomologacao)
      : null;

  if (needsProducaoHook && !producaoCompanyToken) {
    console.error(
      "[fiscal/focus-gateway] registrarWebhook (PRODUCAO) pulado — token da empresa ausente",
    );
  }
  if (needsHomologacaoHook && !homologacaoCompanyToken) {
    console.error(
      "[fiscal/focus-gateway] registrarWebhook (HOMOLOGACAO) pulado — token da empresa ausente",
    );
  }

  const [producaoResult, homologacaoResult] = await Promise.allSettled([
    producaoCompanyToken
      ? registrarWebhook(registration, "PRODUCAO", producaoCompanyToken)
      : Promise.resolve(null),
    homologacaoCompanyToken
      ? registrarWebhook(registration, "HOMOLOGACAO", homologacaoCompanyToken)
      : Promise.resolve(null),
  ]);

  const webhookPatch: CompanyProfilePatch = {};

  if (producaoResult.status === "fulfilled" && producaoResult.value) {
    webhookPatch[producaoHookField] = producaoResult.value.id;
  } else if (producaoResult.status === "rejected") {
    console.error("[fiscal/focus-gateway] registrarWebhook (PRODUCAO) falhou", {
      message:
        producaoResult.reason instanceof Error
          ? producaoResult.reason.message
          : producaoResult.reason,
    });
  }

  if (homologacaoResult.status === "fulfilled" && homologacaoResult.value) {
    webhookPatch[homologacaoHookField] = homologacaoResult.value.id;
  } else if (homologacaoResult.status === "rejected") {
    console.error(
      "[fiscal/focus-gateway] registrarWebhook (HOMOLOGACAO) falhou",
      {
        message:
          homologacaoResult.reason instanceof Error
            ? homologacaoResult.reason.message
            : homologacaoResult.reason,
      },
    );
  }

  return Object.keys(webhookPatch).length > 0 ? webhookPatch : null;
}
