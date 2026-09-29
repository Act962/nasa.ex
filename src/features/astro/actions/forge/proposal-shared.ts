import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AstroActionResult } from "../types";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

export const PROPOSAL_PICKER: AstroPicker = {
  kind: "entity",
  entity: "proposal",
  placeholder: "Buscar proposta por número, título ou cliente",
};

/**
 * Domínio das propostas do Forge para o ASTRO (spec 0032): achar a proposta,
 * casar produtos por nome, somar o total e dizer tudo isso em português.
 *
 * Fica fora das ações porque criar, editar, cancelar e excluir precisam das
 * mesmas respostas, e uma cópia em cada uma já foi o bastante para a proposta
 * nascer com o produto só na descrição.
 */

const MAX_PRODUCTS_SCANNED = 500;
const MAX_CLIENT_CANDIDATES = 5;

export const FORGE_APP_NAME = "Forge";

/** Situações em que a proposta ainda aceita alteração (CB-5). */
const EDITABLE_STATUSES = new Set(["RASCUNHO", "ENVIADA", "VISUALIZADA", "EXPIRADA"]);

export const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISUALIZADA: "Visualizada",
  PAGA: "Paga",
  EXPIRADA: "Expirada",
  CANCELADA: "Cancelada",
};

export function formatMoney(value: Prisma.Decimal | number | string): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem validade";
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toSearchTokens(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9%]+/)
    .filter((token) => token.length >= 3);
}

/** "2 Setup (Única) e a Assinatura ÓRBITA" → dois pedidos, um com quantidade 2. */
export function splitProductRequests(productName: string): { name: string; quantity: number }[] {
  return productName
    .split(/\s*(?:,|;|\+|\be\b(?=\s+(?:o|a|os|as|\d)))\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .map((part) => {
      const withQuantity = part.match(/^(\d{1,3})\s*(?:x|un|unidades?|de)?\s+(.+)$/i);
      if (!withQuantity) return { name: part, quantity: 1 };
      return { name: withQuantity[2].trim(), quantity: Number(withQuantity[1]) || 1 };
    });
}

export type ForgeProductMatch = {
  id: string;
  name: string;
  unitValue: string;
  quantity: number;
};

export type ResolvedProducts = {
  found: ForgeProductMatch[];
  notFound: string[];
  /** Mais de um produto com o mesmo nome pedido (CB-2). */
  ambiguous: { requested: string; options: { id: string; label: string }[] } | null;
};

/**
 * Casa por palavras, não por trecho: o classificador escreve "Assinatura
 * ÓRBITA (uso recorrente)" e o catálogo tem "Assinatura ÓRBITA — uso
 * recorrente". Empate real vira pergunta, não escolha nossa.
 */
export async function resolveProducts(
  productName: string,
  organizationId: string,
): Promise<ResolvedProducts> {
  const catalog = await prisma.forgeProduct.findMany({
    where: { organizationId },
    select: { id: true, name: true, value: true },
    take: MAX_PRODUCTS_SCANNED,
  });

  const found: ForgeProductMatch[] = [];
  const notFound: string[] = [];

  for (const request of splitProductRequests(productName)) {
    // Escolhido na busca: vem com o id, e o id vale mais que o nome.
    const pickedProduct = parsePickedAnswer(request.name);
    if (pickedProduct.id) {
      const product = catalog.find((item) => item.id === pickedProduct.id);
      if (product) {
        found.push({
          id: product.id,
          name: product.name,
          unitValue: product.value.toString(),
          quantity: request.quantity,
        });
      } else {
        notFound.push(pickedProduct.label);
      }
      continue;
    }
    const requestedTokens = toSearchTokens(request.name);
    if (requestedTokens.length === 0) continue;

    const matches = catalog
      .filter((product) => {
        const productTokens = new Set(toSearchTokens(product.name));
        return requestedTokens.every((token) => productTokens.has(token));
      })
      .filter((product) => !found.some((item) => item.id === product.id))
      .sort((first, second) => first.name.length - second.name.length);

    if (matches.length === 0) {
      notFound.push(request.name);
      continue;
    }
    // Empate só quando os nomes têm o mesmo tamanho: "Setup (Única)" e
    // "Setup (Única) · única" são indistinguíveis pelo que o usuário disse.
    if (matches.length > 1 && matches[0].name.length === matches[1].name.length) {
      return {
        found,
        notFound,
        ambiguous: {
          requested: request.name,
          options: matches.slice(0, 5).map((product) => ({
            id: product.id,
            label: `${product.name} — ${formatMoney(product.value)}`,
          })),
        },
      };
    }

    found.push({
      id: matches[0].id,
      name: matches[0].name,
      unitValue: matches[0].value.toString(),
      quantity: request.quantity,
    });
  }

  return { found, notFound, ambiguous: null };
}

export function sumProducts(products: { unitValue: string; quantity: number }[]): number {
  return products.reduce((total, product) => total + Number(product.unitValue) * product.quantity, 0);
}

export function describeProductLine(product: ForgeProductMatch): string {
  const quantityPrefix = product.quantity > 1 ? `${product.quantity}× ` : "";
  return `${quantityPrefix}${product.name} — ${formatMoney(product.unitValue)}`;
}

export function describeProducts(found: ForgeProductMatch[], notFound: string[]): string {
  const parts: string[] = [];
  if (found.length) {
    parts.push(
      `com ${found.map(describeProductLine).join(", ")} (total ${formatMoney(sumProducts(found))})`,
    );
  }
  if (notFound.length) parts.push(`não achei no Forge: ${notFound.join(", ")}`);
  return parts.length ? `, ${parts.join("; ")}.` : ".";
}

export const proposalSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  validUntil: true,
  publicToken: true,
  clientId: true,
  client: { select: { id: true, name: true } },
  products: {
    orderBy: { order: "asc" },
    select: {
      id: true,
      quantity: true,
      unitValue: true,
      product: { select: { id: true, name: true } },
    },
  },
  _count: { select: { contracts: true } },
} satisfies Prisma.ForgeProposalSelect;

export type ProposalRow = Prisma.ForgeProposalGetPayload<{ select: typeof proposalSelect }>;

export function proposalTotal(proposal: ProposalRow): number {
  return proposal.products.reduce(
    (total, item) => total + Number(item.unitValue) * Number(item.quantity),
    0,
  );
}

export function isEditable(proposal: ProposalRow): boolean {
  return EDITABLE_STATUSES.has(proposal.status);
}

export function buildPublicUrl(publicToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/proposta/${publicToken}`;
}

export function buildInternalUrl(proposalId: string): string {
  return `/forge?tab=proposals&id=${proposalId}`;
}

/** "#14", "proposta 14", "numero 14" — o número que o usuário citou. */
export function extractProposalNumber(reference: string): number | null {
  const match = reference.match(/#?\s*(\d{1,6})\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** "a do Kauê" é o cliente Kauê: artigo e preposição não fazem parte do nome. */
const REFERENCE_PREFIX_WORDS = new Set([
  "a", "o", "as", "os", "da", "do", "das", "dos", "de", "para", "pro", "pra",
  "ultima", "ultimo", "proposta", "propostas", "orcamento", "orcamentos",
]);

/**
 * Descarta as palavras de ligação do começo e devolve o resto COM acento: a
 * busca vai para o banco, onde "Kauê" tem acento. Comparar sem acento fazia
 * "kaue" achar só "Kauer Grupo Ativa" — outro cliente, sem proposta nenhuma.
 */
function cleanClientReference(reference: string): string {
  const words = reference.trim().split(/\s+/);
  let start = 0;
  while (start < words.length && REFERENCE_PREFIX_WORDS.has(normalizeText(words[start]))) {
    start += 1;
  }
  return words.slice(start).join(" ").trim();
}

export type ProposalLookup =
  | { kind: "found"; proposal: ProposalRow }
  | { kind: "not_found"; result: AstroActionResult }
  | { kind: "ambiguous"; result: AstroActionResult };

function notFound(description: string, field: string, title = "Proposta não encontrada"): ProposalLookup {
  return {
    kind: "not_found",
    result: {
      status: "needs_input",
      title,
      description,
      missingFields: [{ key: field, label: "a proposta" }],
      appName: FORGE_APP_NAME,
      picker: PROPOSAL_PICKER,
    },
  };
}

/**
 * Acha a proposta pelo número ("#14") ou pelo cliente ("a do Kauê"). Pelo
 * cliente vale a mais recente, e quem chama mostra o número no cartão (CB-3).
 */
export async function findProposal(params: {
  organizationId: string;
  reference: string;
  field?: string;
}): Promise<ProposalLookup> {
  const field = params.field ?? "proposalRef";
  if (!params.reference.trim()) {
    return notFound("Busque a proposta pelo número, título ou cliente.", field, "Qual proposta?");
  }
  // Escolhida na busca do cartão: o id decide sozinho.
  const picked = parsePickedAnswer(params.reference);
  if (picked.id) {
    const proposal = await prisma.forgeProposal.findFirst({
      where: { id: picked.id, organizationId: params.organizationId },
      select: proposalSelect,
    });
    if (proposal) return { kind: "found", proposal };
    return notFound("Essa proposta não existe mais. Busque outra.", field);
  }
  const number = extractProposalNumber(params.reference);

  if (number !== null) {
    const proposal = await prisma.forgeProposal.findUnique({
      where: { organizationId_number: { organizationId: params.organizationId, number } },
      select: proposalSelect,
    });
    if (proposal) return { kind: "found", proposal };
    return notFound(`Não achei a proposta #${number}. Qual é o número?`, field);
  }

  const clientName = cleanClientReference(params.reference.replace(/_/g, " "));
  const clients = clientName
    ? await prisma.lead.findMany({
        where: {
          name: { contains: clientName, mode: "insensitive" },
          tracking: { organizationId: params.organizationId },
        },
        select: { id: true, name: true },
        take: MAX_CLIENT_CANDIDATES,
      })
    : [];
  if (clients.length === 0) {
    return notFound(
      `Não achei proposta nem cliente com "${params.reference}". Me diz o número da proposta.`,
      field,
    );
  }

  const proposals = await prisma.forgeProposal.findMany({
    where: {
      organizationId: params.organizationId,
      clientId: { in: clients.map((client) => client.id) },
    },
    orderBy: { number: "desc" },
    take: MAX_CLIENT_CANDIDATES,
    select: proposalSelect,
  });
  if (proposals.length === 0) {
    return notFound(
      `${clients[0].name} ainda não tem nenhuma proposta. Me diz o número, ou peça para eu criar uma.`,
      field,
    );
  }
  return { kind: "found", proposal: proposals[0] };
}

export function describeProposal(proposal: ProposalRow): string {
  const items = proposal.products.length
    ? proposal.products
        .map((item) => {
          const quantity = Number(item.quantity);
          const prefix = quantity > 1 ? `${quantity}× ` : "";
          return `${prefix}${item.product.name} — ${formatMoney(item.unitValue)}`;
        })
        .join(", ")
    : "sem itens";
  return (
    `Proposta #${proposal.number} "${proposal.title}"` +
    (proposal.client ? ` para ${proposal.client.name}` : "") +
    `: ${items}. Total ${formatMoney(proposalTotal(proposal))}, ` +
    `${STATUS_LABELS[proposal.status] ?? proposal.status}, ${formatDate(proposal.validUntil)}.`
  );
}

/** "a proposta #14", "a proposta do Kauê" → a referência, sem modelo. */
export function inferProposalRef(text: string): Record<string, unknown> {
  const reference = text.match(/\bproposta\s+(#?\d+|d[oa]\s+[^,.!?]+?)(?=\s+(?:para|com|e|por)\b|[,.!?]|$)/iu)?.[1];
  return reference ? { proposalRef: reference.trim() } : {};
}
