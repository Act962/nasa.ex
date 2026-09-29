import "server-only";
import prisma from "@/lib/prisma";
import { ASKS, plural, type AstroQuery, type AstroQueryResult } from "./types";
import {
  STATUS_LABELS,
  extractProposalNumber,
  formatMoney,
  normalizeText,
  proposalSelect,
  proposalTotal,
  type ProposalRow,
} from "@/features/astro/actions/forge/proposal-shared";
import { rememberProposal } from "@/features/astro/actions/forge/proposal-context";

/**
 * Leitura de propostas do Forge em código (spec 0032, RF-3/RF-4; camada da
 * spec 0026). "Quais propostas o Kauê tem e o valor?" respondia "14
 * rascunhos" — sem filtrar o cliente e sem valor nenhum.
 *
 * Estas duas vêm ANTES da contagem genérica de propostas: `run` devolve `null`
 * quando não acha o cliente citado, e aí a genérica responde. É como a ordem
 * do registro conversa com o banco, já que `matches` é síncrono.
 */

const PROPOSAL_WORD = /\bpropostas?|orcamentos?\b/;
const LATEST = /\b(ultima|ultimo|mais recente)\b/;
const MAX_ROWS = 30;

const MAX_LEADS_SCANNED = 300;

/**
 * Qual cliente a frase cita.
 *
 * Procurar o nome depois de "do/da/de" não serve: ninguém fala só assim
 * ("quais propostas o Kauê TEM"). Em vez de adivinhar pela gramática, a
 * checagem é contra o banco — o nome precisa existir na organização e aparecer
 * na frase inteira. Mesma ideia do `subjectFromHistory` das ações.
 */
async function findMentionedClient(
  organizationId: string,
  text: string,
): Promise<{ id: string; name: string }[]> {
  const leads = await prisma.lead.findMany({
    where: { tracking: { organizationId } },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_LEADS_SCANNED,
  });

  const words = new Set(
    text
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3),
  );

  const mentioned = leads.filter((lead) => {
    const nameTokens = normalizeText(lead.name)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);
    return nameTokens.length > 0 && nameTokens.every((token) => words.has(token));
  });
  if (mentioned.length === 0) return [];

  // Nome mais específico ganha: "Kauer Grupo Ativa" antes de "Kauê".
  const longest = mentioned.reduce((best, lead) =>
    lead.name.length > best.name.length ? lead : best,
  );
  const chosenTokens = normalizeText(longest.name);
  return mentioned.filter((lead) => normalizeText(lead.name) === chosenTokens);
}

function proposalsTable(proposals: ProposalRow[], clientName: string): AstroQueryResult {
  return {
    text: `${proposals.length} ${plural(proposals.length, "proposta", "propostas")} de ${clientName}:`,
    table: {
      kind: "astro_table",
      entityType: "proposal",
      title: `Propostas de ${clientName}`,
      columns: [
        { key: "numero", label: "Nº" },
        { key: "titulo", label: "Título" },
        { key: "situacao", label: "Situação", type: "badge" },
        { key: "validade", label: "Validade" },
        { key: "total", label: "Total" },
      ],
      rows: proposals.map((proposal) => ({
        id: proposal.id,
        numero: `#${proposal.number}`,
        titulo: proposal.title,
        situacao: STATUS_LABELS[proposal.status] ?? proposal.status,
        validade: proposal.validUntil
          ? proposal.validUntil.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
          : "—",
        total: formatMoney(proposalTotal(proposal)),
      })),
      totalCount: proposals.length,
    },
  };
}

const proposalsByClient: AstroQuery = {
  key: "forge.proposals_by_client",
  app: "forge",
  appKey: "forge",
  matches: (text) =>
    // "Propostas da Maria Clara" é pergunta mesmo sem "quais".
    (ASKS.test(text) || /^(as\s+)?(propostas?|orcamentos?)\s+d[oae]s?\b/.test(text)) &&
    PROPOSAL_WORD.test(text) &&
    !/\bprodutos?\b/.test(text),
  run: async ({ ctx, text }) => {
    // Sem cliente citado, a contagem genérica por situação responde — é a
    // ordem do registro fazendo a triagem (spec 0026, D-2).
    const clients = await findMentionedClient(ctx.organizationId, text);
    if (clients.length === 0) return null;

    const proposals = await prisma.forgeProposal.findMany({
      where: {
        organizationId: ctx.organizationId,
        clientId: { in: clients.map((client) => client.id) },
      },
      orderBy: { number: "desc" },
      take: MAX_ROWS,
      select: proposalSelect,
    });
    if (proposals.length === 0) {
      return { text: `${clients[0].name} ainda não tem nenhuma proposta.` };
    }

    // A conversa passa a falar desta proposta: "adiciona o Setup nela" (RF-6).
    if (proposals.length === 1) rememberProposal(ctx, proposals[0].number);
    return proposalsTable(proposals, clients[0].name);
  },
};

const proposalDetail: AstroQuery = {
  key: "forge.proposal_detail",
  app: "forge",
  appKey: "forge",
  matches: (text) =>
    PROPOSAL_WORD.test(text) &&
    (extractProposalNumber(text) !== null || LATEST.test(text)) &&
    (ASKS.test(text) || /\b(abre|abrir|ver|detalhe|detalhes)\b/.test(text)),
  run: async ({ ctx, text }) => {
    const number = extractProposalNumber(text);
    // "A última proposta da Maria Clara": sem número, vale a mais recente do cliente citado.
    let proposal: ProposalRow | null = null;
    if (number !== null) {
      proposal = await prisma.forgeProposal.findUnique({
        where: { organizationId_number: { organizationId: ctx.organizationId, number } },
        select: proposalSelect,
      });
    } else {
      const clients = await findMentionedClient(ctx.organizationId, text);
      if (clients.length === 0) return null;
      proposal = await prisma.forgeProposal.findFirst({
        where: { organizationId: ctx.organizationId, clientId: { in: clients.map((client) => client.id) } },
        orderBy: { number: "desc" },
        select: proposalSelect,
      });
    }
    if (!proposal) return null;

    rememberProposal(ctx, proposal.number);

    if (proposal.products.length === 0) {
      return {
        text:
          `Proposta #${proposal.number} "${proposal.title}"` +
          (proposal.client ? ` de ${proposal.client.name}` : "") +
          `: sem itens, total ${formatMoney(0)}, ` +
          `${STATUS_LABELS[proposal.status] ?? proposal.status}.`,
      };
    }

    return {
      text:
        `Proposta #${proposal.number} "${proposal.title}"` +
        (proposal.client ? ` de ${proposal.client.name}` : "") +
        `, ${STATUS_LABELS[proposal.status] ?? proposal.status}. ` +
        `Total ${formatMoney(proposalTotal(proposal))}.`,
      table: {
        kind: "astro_table",
        entityType: "proposal",
        title: `Itens da proposta #${proposal.number}`,
        columns: [
          { key: "produto", label: "Produto" },
          { key: "quantidade", label: "Qtd", type: "number" },
          { key: "unitario", label: "Unitário" },
          { key: "subtotal", label: "Subtotal" },
        ],
        rows: proposal.products.map((item) => ({
          id: item.id,
          produto: item.product.name,
          quantidade: Number(item.quantity),
          unitario: formatMoney(item.unitValue.toString()),
          subtotal: formatMoney(Number(item.unitValue) * Number(item.quantity)),
        })),
        totalCount: proposal.products.length,
      },
    };
  },
};

// Detalhe antes da lista: "detalhe da última proposta da Maria" é uma proposta, não todas.
export const FORGE_QUERIES: AstroQuery[] = [proposalDetail, proposalsByClient];
