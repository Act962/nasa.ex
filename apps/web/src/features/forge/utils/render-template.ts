// Substituição de variáveis em templates do Forge (contratos e propostas).
// Funciona como utilitário puro, testável, sem dependências de framework.

const PT_BR = "pt-BR";

const fmtBRL = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString(PT_BR, { style: "currency", currency: "BRL" });
};

const fmtDate = (d: Date | string | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(PT_BR, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const fmtMes = (d: Date): string =>
  d.toLocaleDateString(PT_BR, { month: "long" });

const padNumber = (n: number | null | undefined): string =>
  n != null ? `#${String(n).padStart(4, "0")}` : "";

export type RenderContext = {
  organization: {
    name: string | null;
    cnpj: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  };
  // Cliente: se vier de proposal.client (Lead), usa esses dados.
  // Se houver clientData manual no contrato, ele tem prioridade.
  client: {
    name: string | null;
    email: string | null;
    document: string | null;
    phone: string | null;
    address: string | null;
    contactName: string | null;
  } | null;
  contract: {
    number: number | null;
    value: string | number | null;
    startDate: Date | string | null;
    endDate: Date | string | null;
  } | null;
  proposal: {
    number: number | null;
    title: string | null;
    validUntil: Date | string | null;
  } | null;
  now?: Date;
};

const formatAddress = (
  o: RenderContext["organization"] | RenderContext["client"],
): string | null => {
  if (!o) return null;
  if ("address" in o) return o.address ?? null;
  const parts = [o.addressLine, o.city, o.state, o.postalCode].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
};

// Mapa de variável → resolver. Retorna null se o dado não existe.
const RESOLVERS: Record<string, (ctx: RenderContext) => string | null> = {
  // Empresa (Contratada)
  empresa_nome: (c) => c.organization.name,
  empresa_cnpj: (c) => c.organization.cnpj,
  empresa_email: (c) => c.organization.contactEmail,
  empresa_contato: (c) => c.organization.contactPhone,
  empresa_telefone: (c) => c.organization.contactPhone,
  "empresa_endereço": (c) => formatAddress(c.organization),
  empresa_endereco: (c) => formatAddress(c.organization),
  empresa_cidade: (c) => c.organization.city,
  empresa_estado: (c) => c.organization.state,
  empresa_cep: (c) => c.organization.postalCode,

  // Cliente (Contratante)
  cliente_nome: (c) => c.client?.name ?? null,
  cliente_email: (c) => c.client?.email ?? null,
  cliente_telefone: (c) => c.client?.phone ?? null,
  cliente_documento: (c) => c.client?.document ?? null,
  cliente_cnpj: (c) => c.client?.document ?? null,
  cliente_cpf: (c) => c.client?.document ?? null,
  "cliente_endereço": (c) => formatAddress(c.client),
  cliente_endereco: (c) => formatAddress(c.client),
  cliente_contato: (c) => c.client?.contactName ?? c.client?.name ?? null,

  // Contrato
  valor: (c) => fmtBRL(c.contract?.value ?? null),
  inicio: (c) => fmtDate(c.contract?.startDate ?? null),
  termino: (c) => fmtDate(c.contract?.endDate ?? null),
  contrato_numero: (c) => padNumber(c.contract?.number ?? null),

  // Proposta
  proposta_numero: (c) => padNumber(c.proposal?.number ?? null),
  proposta_titulo: (c) => c.proposal?.title ?? null,
  proposta_validade: (c) => fmtDate(c.proposal?.validUntil ?? null),

  // Data e tempo (sempre resolvido)
  data: (c) => fmtDate(c.now ?? new Date()),
  data_extenso: (c) => fmtDate(c.now ?? new Date()),
  mes: (c) => fmtMes(c.now ?? new Date()),
  ano: (c) => String((c.now ?? new Date()).getFullYear()),
  dia: (c) => String((c.now ?? new Date()).getDate()).padStart(2, "0"),
};

const VAR_REGEX = /\{\{\s*([\wÀ-ÿ_]+)\s*\}\}/g;

const HUMAN_LABELS: Record<string, string> = {
  empresa_nome: "Nome da empresa",
  empresa_cnpj: "CNPJ da empresa",
  empresa_email: "E-mail da empresa",
  empresa_contato: "Contato da empresa",
  empresa_telefone: "Telefone da empresa",
  "empresa_endereço": "Endereço da empresa",
  empresa_endereco: "Endereço da empresa",
  empresa_cidade: "Cidade da empresa",
  empresa_estado: "Estado da empresa",
  empresa_cep: "CEP da empresa",
  cliente_nome: "Nome do cliente",
  cliente_email: "E-mail do cliente",
  cliente_telefone: "Telefone do cliente",
  cliente_documento: "Documento do cliente",
  cliente_cnpj: "CNPJ do cliente",
  cliente_cpf: "CPF do cliente",
  "cliente_endereço": "Endereço do cliente",
  cliente_endereco: "Endereço do cliente",
  cliente_contato: "Contato do cliente",
  valor: "Valor",
  inicio: "Data de início",
  termino: "Data de término",
  contrato_numero: "Número do contrato",
  proposta_numero: "Número da proposta",
  proposta_titulo: "Título da proposta",
  proposta_validade: "Validade da proposta",
};

const humanLabel = (key: string): string =>
  HUMAN_LABELS[key] ?? key.replace(/_/g, " ");

export type RenderOptions = {
  // Quando true (default), variáveis vazias renderizam um marcador HTML em vermelho.
  // Quando false, viram string vazia.
  highlightMissing?: boolean;
};

// Renderiza substituindo variáveis. Marcadores de "faltando" usam um span com
// classe destacada (renderizado via dangerouslySetInnerHTML no consumidor).
export function renderTemplate(
  template: string | null | undefined,
  ctx: RenderContext,
  opts: RenderOptions = {},
): string {
  if (!template) return "";
  const highlight = opts.highlightMissing ?? true;

  return template.replace(VAR_REGEX, (full, key: string) => {
    const resolver = RESOLVERS[key];
    if (!resolver) return full; // variável desconhecida: deixa literal
    const v = resolver(ctx);
    if (v === null || v === undefined || v === "") {
      if (!highlight) return "";
      const label = humanLabel(key);
      return `<span class="forge-missing-var" data-var="${key}">[${label} não preenchido]</span>`;
    }
    return v;
  });
}

// Lista de variáveis disponíveis (para UI de inserção).
export const AVAILABLE_VARIABLES: { key: string; placeholder: string; label: string }[] =
  Object.keys(RESOLVERS).map((key) => ({
    key,
    placeholder: `{{${key}}}`,
    label: humanLabel(key),
  }));

// Encontra variáveis no template que não conseguiram resolver com o ctx atual.
// Útil para mostrar ao usuário o que falta antes de salvar.
export function findUnresolved(
  template: string | null | undefined,
  ctx: RenderContext,
): { key: string; label: string }[] {
  if (!template) return [];
  const used = new Set<string>();
  for (const m of template.matchAll(VAR_REGEX)) {
    used.add(m[1]);
  }
  const result: { key: string; label: string }[] = [];
  for (const key of used) {
    const resolver = RESOLVERS[key];
    if (!resolver) continue;
    const v = resolver(ctx);
    if (v === null || v === undefined || v === "") {
      result.push({ key, label: humanLabel(key) });
    }
  }
  return result;
}
