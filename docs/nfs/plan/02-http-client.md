# Etapa 2 — HTTP Client Focus NFe

## Objetivo

Criar `src/http/focus-nfe/` com o cliente HTTP da Focus, tipos, operações e builder de payload. Espelha o padrão de `src/http/nerp/client.ts`.

## Arquivos a criar

```
src/http/focus-nfe/
├── client.ts           # focusFetch + FocusNfeHttpError
├── types.ts            # tipos de payload e resposta
├── operations.ts       # emitirNfse, consultarNfse, cancelarNfse, registrarWebhook, consultarEmpresa
└── build-nfse-payload.ts  # monta payload + pré-flight de validação
```

---

## `src/http/focus-nfe/client.ts`

```typescript
import { FiscalEnvironment } from "@/generated/prisma/enums";

const TIMEOUT_MS = 15_000;

const BASE_URLS: Record<FiscalEnvironment, string> = {
  HOMOLOGACAO: "https://homologacao.focusnfe.com.br/v2",
  PRODUCAO: "https://api.focusnfe.com.br/v2",
};

export class FocusNfeHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
    public readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "FocusNfeHttpError";
  }
}

function resolveToken(environment: FiscalEnvironment): string {
  const token =
    environment === "HOMOLOGACAO"
      ? process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO
      : process.env.FOCUS_NFE_TOKEN_PRODUCAO;
  if (!token) throw new FocusNfeHttpError(0, "MISSING_TOKEN", `FOCUS_NFE_TOKEN_${environment} ausente`);
  return token;
}

function buildBasicAuth(environment: FiscalEnvironment): string {
  const token = resolveToken(environment);
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

export type FocusFetchOptions = {
  method: "GET" | "POST" | "DELETE";
  path: string;                    // ex: "/nfse?ref=forge-xxx-1"
  body?: unknown;
  environment: FiscalEnvironment;
};

export async function focusFetch<T>(opts: FocusFetchOptions): Promise<T> {
  const baseUrl = BASE_URLS[opts.environment];
  const url = `${baseUrl}${opts.path}`;
  const bodyJson = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method,
      headers: {
        Authorization: buildBasicAuth(opts.environment),
        ...(bodyJson ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
      },
      body: bodyJson,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new FocusNfeHttpError(0, "TIMEOUT", `Focus NFe request timed out after ${TIMEOUT_MS}ms`);
    }
    throw new FocusNfeHttpError(0, "NETWORK", err instanceof Error ? err.message : "network error");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let parsed: { mensagem_erros?: string[]; msg?: string } | null = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    const message =
      parsed?.mensagem_erros?.[0] ??
      parsed?.msg ??
      text ||
      `Focus NFe HTTP ${response.status}`;
    throw new FocusNfeHttpError(response.status, null, message, text.slice(0, 500));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
```

---

## `src/http/focus-nfe/types.ts`

```typescript
export type NfsePrestador = {
  cnpj: string;
  inscricao_municipal: string;
  codigo_municipio: string;
};

export type NfseTomadorPJ = {
  cnpj: string;
  razao_social: string;
  email?: string;
  telefone?: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigo_municipio: string;
    uf: string;
    cep: string;
  };
};

export type NfseTomadorPF = {
  cpf: string;
  nome_completo: string;
  email?: string;
  telefone?: string;
};

export type NfseServico = {
  aliquota: number;
  iss_retido: boolean;
  item_lista_servico: string;
  discriminacao: string;
  codigo_municipio: string;
  valor_servicos: number;
  valor_iss?: number;
  deducoes?: number;
};

export type NfsePayload = {
  data_emissao: string;            // ISO 8601
  data_competencia?: string;       // ISO 8601 (mês de referência)
  natureza_operacao: number;       // 1 = Tributação no município
  optante_simples_nacional: boolean;
  regime_especial_tributacao?: number;
  prestador: NfsePrestador;
  tomador: NfseTomadorPJ | NfseTomadorPF;
  servico: NfseServico;
};

export type FocusNfseStatus =
  | "processando_autorizacao"
  | "autorizado"
  | "erro_autorizacao"
  | "cancelado";

export type FocusNfseResponse = {
  status: FocusNfseStatus;
  ref: string;
  numero?: string;
  codigo_verificacao?: string;
  url?: string;
  url_danfse?: string;
  caminho_xml_nota_fiscal?: string;
  mensagem_erro?: string;
  mensagem_erros?: string[];
  // Campos extras que a Focus pode retornar:
  [key: string]: unknown;
};

export type FocusEmpresaResponse = {
  cnpj: string;
  nome: string;
  // ... outros campos
};

export type FocusWebhookRegistration = {
  event: "nfse";
  url: string;
  authorization?: string;
};
```

---

## `src/http/focus-nfe/operations.ts`

```typescript
import { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { NfsePayload, FocusNfseResponse, FocusEmpresaResponse, FocusWebhookRegistration } from "./types";

export async function emitirNfse(
  ref: string,
  payload: NfsePayload,
  environment: FiscalEnvironment,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "POST",
    path: `/nfse?ref=${encodeURIComponent(ref)}`,
    body: payload,
    environment,
  });
}

export async function consultarNfse(
  ref: string,
  environment: FiscalEnvironment,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "GET",
    path: `/nfse/${encodeURIComponent(ref)}`,
    environment,
  });
}

export async function cancelarNfse(
  ref: string,
  justificativa: string,
  environment: FiscalEnvironment,
): Promise<void> {
  await focusFetch<void>({
    method: "DELETE",
    path: `/nfse/${encodeURIComponent(ref)}`,
    body: { justificativa },
    environment,
  });
}

export async function registrarWebhook(
  registration: FocusWebhookRegistration,
  environment: FiscalEnvironment,
): Promise<void> {
  await focusFetch<void>({
    method: "POST",
    path: "/hooks",
    body: registration,
    environment,
  });
}

export async function consultarEmpresa(
  cnpj: string,
  environment: FiscalEnvironment,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "GET",
    path: `/empresas/${cnpj.replace(/\D/g, "")}`,
    environment,
  });
}
```

---

## `src/http/focus-nfe/build-nfse-payload.ts`

```typescript
import type { FiscalCompanyProfile, ForgeContract, TomadorType } from "@/generated/prisma/client";
import type { NfsePayload } from "./types";

export type IssueOverrides = {
  tipoTomador: TomadorType;
  discriminacao?: string;
  dataCompetencia: Date;
  // override de dados do tomador (completar endereço para PJ, etc.)
  tomadorCnpj?: string;
  tomadorCpf?: string;
  tomadorRazaoSocial?: string;
  tomadorNome?: string;
  tomadorEmail?: string;
  // endereço tomador PJ
  tomadorLogradouro?: string;
  tomadorNumero?: string;
  tomadorComplemento?: string;
  tomadorBairro?: string;
  tomadorCodigoMunicipio?: string;
  tomadorUf?: string;
  tomadorCep?: string;
};

export type PreflightResult = {
  valid: boolean;
  errors: string[];
};

export function validateBeforeEmit(
  contract: ForgeContract,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
): PreflightResult {
  const errors: string[] = [];

  if (!profile.supportedByFocus) errors.push("Município do prestador não está integrado na Focus NFe.");
  if (!profile.focusEmpresaRegistered) errors.push("Empresa não está cadastrada na Focus NFe.");
  if (!profile.inscricaoMunicipal) errors.push("Inscrição municipal do prestador não configurada.");
  if (!/^\d{7}$/.test(profile.codigoMunicipio)) errors.push("Código IBGE do município inválido (deve ter 7 dígitos).");
  if (!profile.defaultItemListaServico) errors.push("Item da lista de serviço (LC 116) não configurado.");
  if (Number(profile.defaultAliquotaIss) <= 0) errors.push("Alíquota ISS inválida.");
  if (Number(contract.value) <= 0) errors.push("Valor do contrato deve ser maior que zero.");

  if (overrides.tipoTomador === "PJ") {
    const cnpj = (overrides.tomadorCnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) errors.push("CNPJ do tomador inválido.");
    if (!overrides.tomadorRazaoSocial) errors.push("Razão social do tomador obrigatória para PJ.");
    if (!overrides.tomadorCodigoMunicipio) errors.push("Código de município do tomador obrigatório para PJ.");
  } else {
    const cpf = (overrides.tomadorCpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11) errors.push("CPF do tomador inválido.");
    if (!overrides.tomadorNome) errors.push("Nome do tomador obrigatório para PF.");
  }

  return { valid: errors.length === 0, errors };
}

export function buildNfsePayload(
  contract: ForgeContract,
  profile: FiscalCompanyProfile,
  overrides: IssueOverrides,
): NfsePayload {
  const tomador =
    overrides.tipoTomador === "PJ"
      ? {
          cnpj: (overrides.tomadorCnpj ?? "").replace(/\D/g, ""),
          razao_social: overrides.tomadorRazaoSocial!,
          email: overrides.tomadorEmail,
          endereco: {
            logradouro: overrides.tomadorLogradouro!,
            numero: overrides.tomadorNumero!,
            complemento: overrides.tomadorComplemento,
            bairro: overrides.tomadorBairro!,
            codigo_municipio: overrides.tomadorCodigoMunicipio!,
            uf: overrides.tomadorUf!,
            cep: (overrides.tomadorCep ?? "").replace(/\D/g, ""),
          },
        }
      : {
          cpf: (overrides.tomadorCpf ?? "").replace(/\D/g, ""),
          nome_completo: overrides.tomadorNome!,
          email: overrides.tomadorEmail,
        };

  return {
    data_emissao: new Date().toISOString(),
    data_competencia: overrides.dataCompetencia.toISOString(),
    natureza_operacao: 1,
    optante_simples_nacional: profile.optanteSimplesNacional,
    regime_especial_tributacao: profile.regimeEspecialTributacao
      ? Number(profile.regimeEspecialTributacao)
      : undefined,
    prestador: {
      cnpj: profile.cnpj.replace(/\D/g, ""),
      inscricao_municipal: profile.inscricaoMunicipal,
      codigo_municipio: profile.codigoMunicipio,
    },
    tomador,
    servico: {
      aliquota: Number(profile.defaultAliquotaIss),
      iss_retido: profile.defaultIssRetido,
      item_lista_servico: profile.defaultItemListaServico,
      discriminacao: overrides.discriminacao ?? profile.defaultDiscriminacao ?? `Serviços conforme contrato #${contract.number}`,
      codigo_municipio: profile.codigoMunicipio,
      valor_servicos: Number(contract.value),
    },
  };
}
```

---

## Validação desta etapa

Sem dependências de banco. Pode testar isolado:
```typescript
// Teste manual no REPL ou arquivo temporário:
import { consultarEmpresa } from "@/http/focus-nfe/operations";
const empresa = await consultarEmpresa("00000000000191", "HOMOLOGACAO");
console.log(empresa);
```
