import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { parseCalendarDate } from "../parse-when";
import { rememberProposal } from "./proposal-context";
import { notifyForgeProposalsChanged } from "./proposal-events";
import { extractNameAfter } from "../leads/lead-steps";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";
import {
  FORGE_APP_NAME,
  buildInternalUrl,
  buildPublicUrl,
  describeProducts,
  formatMoney,
  resolveProducts,
  sumProducts,
} from "./proposal-shared";

// Criar proposta comercial no Forge (specs 0023 e 0032). A implementação vivia
// dentro de `nasa-command/execute.ts` e devolvia link interno; aqui ela é a
// fonte única e devolve o link público, que é o que se manda ao cliente.

const MAX_NAME_CANDIDATES = 5;

/** Marcas de "essa proposta não vence" na resposta guiada. */
const NO_DEADLINE = /^(sem validade|nenhuma|nao vence|sem prazo|indeterminada|sem)\b/;

/** Marcas de "não quero produto nenhum" na resposta guiada (CA-2). */
const NO_PRODUCTS = /^(nenhum|nenhuma|nada|sem produto|sem produtos|nenhum por enquanto|depois|pular)\b/;

const CLIENT_PICKER: AstroPicker = {
  kind: "entity",
  entity: "lead",
  placeholder: "Buscar cliente por nome ou telefone",
};

const PRODUCTS_PICKER: AstroPicker = {
  kind: "entity",
  entity: "product",
  multiple: true,
  placeholder: "Buscar produto",
  noneOption: { label: "Nenhum por enquanto", answer: "nenhum" },
};

const VALIDITY_PICKER: AstroPicker = {
  kind: "select",
  options: [
    { label: "7 dias", answer: "7 dias" },
    { label: "15 dias", answer: "15 dias" },
    { label: "30 dias", answer: "30 dias" },
    { label: "Sem validade", answer: "sem validade" },
  ],
};

const DISCOUNT_PHRASE = /\b(?:com\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:de\s+)?desconto\b/iu;

/** "proposta de Consultoria para a Maria Clara, validade de 7 dias" → campos, sem modelo. */
function inferProposalFields(fullText: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  // "com 10% de desconto" é campo próprio: sem tirar da frase, virava produto.
  const discount = fullText.match(DISCOUNT_PHRASE);
  if (discount) inferred.discountPercent = discount[1].replace(",", ".");
  const text = fullText.replace(DISCOUNT_PHRASE, " ").replace(/\s{2,}/g, " ");
  const clientName = extractNameAfter(text, ["para", "pro", "pra", "ao", "do", "da"]);
  if (clientName) inferred.clientName = clientName;
  const products = text.match(
    /\b(?:proposta|orcamento|orçamento)\s+(?:de|com)\s+(.+?)(?=\s+(?:para|pro|pra|ao|com validade|validade)\b|,|$)/iu,
  )?.[1];
  if (products && !/^(validade|\d+\s*dias?)/i.test(products)) inferred.productName = products.trim();
  const validity =
    text.match(/\bvalidade\s+de\s+(\d{1,3}\s*dias?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/iu)?.[1] ??
    text.match(/\b(\d{1,3}\s*dias?)\s+de\s+validade\b/iu)?.[1] ??
    (/\bsem validade\b/i.test(text) ? "sem validade" : undefined);
  if (validity) inferred.validUntil = validity;
  return inferred;
}

const inputSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2)
    .describe("Nome do cliente. Pode ser parcial — a busca é por aproximação."),
  productName: z
    .string()
    .trim()
    .min(2)
    .describe(
      "Produto(s) da proposta, como o usuário disse. Vários vão separados por vírgula, " +
        'e a quantidade vem antes do nome ("2 Setup"). Se ele não quiser nenhum, "nenhum".',
    ),
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("Título da proposta. Sem isso, vira 'Proposta - <cliente>'."),
  validUntil: z
    .string()
    .trim()
    .min(3)
    .describe(
      'Validade, como o usuário disse: "7 dias", "30/10/2026", "sem validade". ' +
        "Não converta para ISO — o código calcula a data.",
    ),
  notes: z.string().trim().max(2000).optional(),
  confirmedTitle: z.string().trim().optional().describe("Título escolhido no roteiro."),
  discountPercent: z.string().trim().optional().describe("Desconto em %, só o número."),
});

/**
 * Teto de desconto da org, lido da memória ativa do ASTRO ("Desconto máximo de
 * 10% sem aprovação do dono"). Sem regra, não há teto: o ASTRO não inventa
 * política que a empresa não escreveu.
 */
async function findDiscountLimit(organizationId: string): Promise<number | null> {
  const rules = await prisma.astroMemory.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { ruleKey: true, numericValue: true, content: true },
  });
  for (const rule of rules) {
    if (rule.ruleKey === "desconto_maximo" && rule.numericValue !== null) return Number(rule.numericValue);
    const written = rule.content.match(/desconto\s+m[aá]ximo\s+(?:de\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/iu)?.[1];
    if (written) return Number(written.replace(",", "."));
  }
  return null;
}

async function findClientCandidates(clientName: string, organizationId: string) {
  // Escolhido na busca do cartão: o id resolve homônimo sem perguntar de novo.
  const picked = parsePickedAnswer(clientName);
  return prisma.lead.findMany({
    where: {
      ...(picked.id
        ? { id: picked.id }
        : { name: { contains: picked.label.replace(/_/g, " "), mode: "insensitive" } }),
      tracking: { organizationId },
    },
    select: { id: true, name: true },
    take: MAX_NAME_CANDIDATES,
  });
}

export const createProposalAction: AstroAction<typeof inputSchema> = {
  key: "forge.create_proposal",
  app: "forge",
  toolName: "create_proposal",
  description:
    "Cria uma proposta comercial no Forge para um cliente e devolve o link público para enviar a ele. " +
    "Use quando o usuário pedir 'cria uma proposta para X', 'monta um orçamento para X'.",
  permission: { appKey: "forge", action: "create" },
  requiresConfirmation: true,
  confirmTitle: "Criar proposta",
  input: inputSchema,
  inferFields: inferProposalFields,
  codeOnlyFields: ["confirmedTitle", "discountPercent"],
  intentPatterns: [
    /^(?!.*\b(cancel\w*|exclu\w*|apag\w*|delet\w*|remov\w*|tira\w*|adicion\w*|acrescent\w*|alter\w*|muda\w*|edit\w*)\b).*\b(cria|criar|crie|monta|montar|monte|gera|gerar|gere|faz|fazer|faca|nova|quero)\b.{0,25}\b(proposta|orcamento)\b/,
  ],
  fieldSteps: {
    clientName: {
      title: "Para qual cliente?",
      question: "Busque o cliente da proposta.",
      picker: CLIENT_PICKER,
    },
    productName: {
      title: "Quais produtos?",
      question: "Escolha os produtos e as quantidades.",
      picker: PRODUCTS_PICKER,
    },
    validUntil: {
      title: "Validade",
      question: "Até quando a proposta vale?",
      picker: VALIDITY_PICKER,
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const organizationId = ctx.organizationId;

    const candidates = await findClientCandidates(input.clientName, organizationId);

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Cliente não encontrado",
        description: `Não achei cliente com "${parsePickedAnswer(input.clientName).label}". Busque abaixo.`,
        missingFields: [{ key: "clientName", label: "nome do cliente" }],
        appName: FORGE_APP_NAME,
        picker: CLIENT_PICKER,
      };
    }

    // Homônimo não vira escolha nossa: quem decide é quem conhece o cliente.
    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de um cliente com esse nome",
        description: `Achei ${candidates.length} clientes parecidos com "${input.clientName}". Qual deles?`,
        field: "clientName",
        options: candidates.map((candidate) => ({
          id: candidate.id,
          label: candidate.name,
        })),
        appName: FORGE_APP_NAME,
        picker: CLIENT_PICKER,
      };
    }

    const client = candidates[0];

    // A data é calculada aqui, não pelo modelo: o classificador não sabe que
    // dia é hoje e já devolveu 2023 para "validade de 7 dias".
    const skipDeadline = NO_DEADLINE.test(input.validUntil.trim().toLowerCase());
    const parsedDeadline = skipDeadline ? null : parseCalendarDate(input.validUntil);
    if (!skipDeadline && (!parsedDeadline || new Date(parsedDeadline) < new Date())) {
      return {
        status: "needs_input",
        title: "Validade não entendida",
        description: `Não consegui ler "${input.validUntil}" como validade. Escolha abaixo.`,
        missingFields: [{ key: "validUntil", label: "a validade" }],
        appName: FORGE_APP_NAME,
        picker: VALIDITY_PICKER,
      };
    }
    const skipProducts = NO_PRODUCTS.test(input.productName.trim().toLowerCase());
    const resolved = skipProducts
      ? { found: [], notFound: [], ambiguous: null }
      : await resolveProducts(input.productName, organizationId);

    if (resolved.ambiguous) {
      return {
        status: "ambiguous",
        title: "Qual produto?",
        description: `Tem mais de um produto parecido com "${resolved.ambiguous.requested}".`,
        field: "productName",
        options: resolved.ambiguous.options,
        appName: FORGE_APP_NAME,
        picker: PRODUCTS_PICKER,
      };
    }

    // Regra da empresa vale antes do cartão (P5): acima do teto, o ASTRO não
    // propõe — oferece o teto ou nenhum desconto.
    const discountPercent = input.discountPercent ? Number(input.discountPercent) : 0;
    if (discountPercent > 0) {
      const limit = await findDiscountLimit(organizationId);
      if (limit !== null && discountPercent > limit) {
        return {
          status: "needs_input",
          title: "Desconto acima da regra",
          description:
            `A regra da empresa limita o desconto a ${limit}% sem aprovação do dono — ` +
            `não posso aplicar ${discountPercent}%. Como fica?`,
          missingFields: [{ key: "discountPercent", label: "o desconto" }],
          appName: FORGE_APP_NAME,
          picker: {
            kind: "select",
            options: [
              { label: `Criar com ${limit}%`, answer: String(limit) },
              { label: "Criar sem desconto", answer: "0" },
            ],
          },
        };
      }
    }
    const discountText = discountPercent > 0 ? ` Desconto de ${discountPercent}%.` : "";

    // Título também é passo do roteiro: vem sugerido, um toque confirma.
    if (!input.confirmedTitle || input.confirmedTitle.length < 2) {
      return {
        status: "needs_input",
        title: "Título da proposta",
        description: "Confirme ou ajuste o título.",
        missingFields: [{ key: "confirmedTitle", label: "o título" }],
        appName: FORGE_APP_NAME,
        picker: {
          kind: "text",
          suggestion: input.title ?? `Proposta - ${client.name}`,
          maxLength: 120,
        },
      };
    }

    const summary =
      (skipProducts
        ? `, sem itens (total ${formatMoney(0)}).`
        : describeProducts(resolved.found, resolved.notFound)) + discountText;

    if (dryRun) {
      return {
        status: "done",
        title: "Criar proposta",
        description: `Proposta para ${client.name}${summary}`,
        appName: FORGE_APP_NAME,
      };
    }

    const lastProposal = await prisma.forgeProposal.findFirst({
      where: { organizationId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const title = input.confirmedTitle;

    // Itens de verdade: antes o produto virava "Produto: X" na descrição e a
    // proposta nascia com total R$ 0,00.
    const proposal = await prisma.forgeProposal.create({
      data: {
        organizationId,
        title,
        number: (lastProposal?.number ?? 0) + 1,
        clientId: client.id,
        responsibleId: ctx.userId,
        participants: [],
        validUntil: parsedDeadline ? new Date(parsedDeadline) : null,
        status: "RASCUNHO",
        description: input.notes ?? null,
        ...(discountPercent > 0 ? { discount: discountPercent, discountType: "PERCENTUAL" as const } : {}),
        headerConfig: {},
        createdById: ctx.userId,
        products: {
          create: resolved.found.map((product, index) => ({
            productId: product.id,
            quantity: product.quantity,
            unitValue: product.unitValue,
            order: index,
          })),
        },
      },
      select: { id: true, number: true, publicToken: true },
    });

    await notifyForgeProposalsChanged(organizationId);
    // A conversa passa a falar desta proposta: "adiciona o Setup nela" (RF-6).
    rememberProposal(ctx, proposal.number);

    return {
      status: "done",
      title: "Proposta criada",
      description: `Proposta #${proposal.number} "${title}" criada para ${client.name}${summary}`,
      publicUrl: buildPublicUrl(proposal.publicToken),
      internalUrl: buildInternalUrl(proposal.id),
      appName: FORGE_APP_NAME,
    };
  },
};
