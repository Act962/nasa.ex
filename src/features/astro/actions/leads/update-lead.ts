import "server-only";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";
import { LEAD_FIELD_STEP, extractEmail, extractNameAfter, extractPhone, normalizeIntent } from "./lead-steps";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";

// Editar dados de um lead. O Astro criava, movia e apagava, mas mudar o
// telefone de alguém — o pedido mais banal do dia a dia — não tinha verbo.

const TEMPERATURE_ALIASES: Record<string, "COLD" | "WARM" | "HOT" | "VERY_HOT"> = {
  frio: "COLD",
  gelado: "COLD",
  morno: "WARM",
  quente: "HOT",
  "muito quente": "VERY_HOT",
  quentissimo: "VERY_HOT",
  cold: "COLD",
  warm: "WARM",
  hot: "HOT",
};

function normalizeTemperature(raw: string) {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return TEMPERATURE_ALIASES[key] ?? null;
}

/** O que mudar, dito como gente fala → campo do input. */
const CHANGE_OPTIONS = [
  { label: "Telefone", answer: "phone" },
  { label: "E-mail", answer: "email" },
  { label: "Nome", answer: "newName" },
  { label: "Valor do negócio", answer: "amount" },
  { label: "Temperatura", answer: "temperature" },
  { label: "Descrição", answer: "description" },
];

const TEMPERATURE_OPTIONS = [
  { label: "Frio", answer: "frio" },
  { label: "Morno", answer: "morno" },
  { label: "Quente", answer: "quente" },
  { label: "Muito quente", answer: "muito quente" },
];

const NEW_VALUE_PICKERS: Record<string, AstroPicker> = {
  phone: { kind: "text", placeholder: "(86) 99999-0000", maxLength: 40 },
  email: { kind: "text", placeholder: "nome@empresa.com", maxLength: 160 },
  newName: { kind: "text", placeholder: "Novo nome", maxLength: 120 },
  amount: { kind: "text", placeholder: "Ex.: 5.000,00", maxLength: 20 },
  temperature: { kind: "select", options: TEMPERATURE_OPTIONS },
  description: { kind: "text", placeholder: "Descrição do lead", maxLength: 2000 },
};

/** "R$ 5.000,00", "5 mil", "1.250,50" → número. */
function parseAmount(raw: string): number | null {
  const normalized = normalizeIntent(raw);
  const thousands = normalized.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (thousands) return Number(thousands[1].replace(",", ".")) * 1000;
  const digits = normalized.replace(/[^\d.,]/g, "");
  if (!digits) return null;
  const value = Number(digits.includes(",") ? digits.replace(/\./g, "").replace(",", ".") : digits.replace(/\.(?=\d{3}\b)/g, ""));
  return Number.isFinite(value) ? value : null;
}

/** "muda o telefone da Maria Clara para 86 9…" → lead e o dado novo, sem modelo. */
function inferUpdateFields(text: string): Record<string, unknown> {
  const normalized = normalizeIntent(text);
  const inferred: Record<string, unknown> = {};
  const leadName = extractNameAfter(text, ["do", "da", "de", "o", "a"]);
  if (leadName) inferred.leadName = leadName;
  const phone = extractPhone(text);
  if (phone && /\b(telefone|celular|whats\w*|fone|numero)\b/.test(normalized)) inferred.phone = phone;
  const email = extractEmail(text);
  if (email) inferred.email = email;
  const temperature = normalized.match(/\b(muito quente|quentissimo|quente|morno|frio|gelado)\b/)?.[1];
  if (temperature && /\b(temperatura|como|esta|ficou|marca)\b/.test(normalized)) inferred.temperature = temperature;
  const amount = normalized.match(/\bvalor\b.*?\b(?:para|pra|de)\s+(r\$\s*)?([\d.,]+\s*(?:mil)?)/)?.[2];
  if (amount) {
    const parsed = parseAmount(amount);
    if (parsed !== null) inferred.amount = parsed;
  }
  return inferred;
}

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Lead a editar. Pode ser parcial."),
  phone: z.string().trim().max(40).optional().describe("Novo telefone."),
  email: z.string().trim().max(160).optional().describe("Novo e-mail."),
  newName: z.string().trim().min(2).max(120).optional().describe("Novo nome do lead."),
  amount: z.number().nonnegative().optional().describe("Valor do negócio, em reais."),
  temperature: z
    .string()
    .trim()
    .optional()
    .describe("Temperatura: frio, morno, quente ou muito quente."),
  description: z.string().trim().max(2000).optional().describe("Nova descrição."),
  fieldToChange: z.string().trim().optional().describe("Campo escolhido no roteiro."),
  newValue: z.string().trim().optional().describe("Valor novo digitado no roteiro."),
});

const FIELD_LABELS: Record<string, string> = {
  phone: "telefone",
  email: "e-mail",
  newName: "nome",
  amount: "valor",
  temperature: "temperatura",
  description: "descrição",
};

export const updateLeadAction: AstroAction<typeof inputSchema> = {
  key: "lead.update",
  app: "leads",
  toolName: "update_lead_fields",
  description:
    "EDITA dados de um lead que já existe — 'muda o telefone do Fulano para X', 'altera o valor do lead para 5 mil', " +
    "'marca o Fulano como quente', 'corrige o e-mail do Fulano'. Não cria, não move e não apaga.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: inferUpdateFields,
  codeOnlyFields: ["fieldToChange", "newValue"],
  intentPatterns: [
    /^(?!.*\b(funil|tracking|coluna|etapa|agenda|workspace|tag|etiqueta|proposta|conta)\b).*\b(muda|mudar|mude|altera|alterar|altere|atualiza|atualizar|atualize|corrige|corrigir|corrija|troca|trocar|troque|edita|editar|edite)\b.{0,30}\b(lead|contato|cliente|telefone|e-?mail|valor|temperatura|descricao)\b/,
    /\bmarca\b.{0,40}\bcomo\s+(frio|morno|quente|muito quente)\b/,
  ],
  fieldSteps: { leadName: LEAD_FIELD_STEP },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Tracking",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    // Roteiro: sem nenhum dado novo na frase, pergunta o quê e depois o valor.
    const hasInlineChange = Boolean(
      input.phone || input.email || input.newName || input.description || input.temperature || input.amount !== undefined,
    );
    const requested: Partial<typeof input> = { ...input };
    if (!hasInlineChange) {
      const fieldToChange = CHANGE_OPTIONS.find(
        (option) => option.answer === input.fieldToChange || option.label === input.fieldToChange,
      )?.answer;
      if (!fieldToChange) {
        return {
          status: "needs_input",
          title: "O que mudar?",
          description: `O que você quer mudar em ${lead.name}?`,
          missingFields: [{ key: "fieldToChange", label: "o que mudar" }],
          appName: "Tracking",
          picker: { kind: "select", options: CHANGE_OPTIONS },
        };
      }
      if (!input.newValue) {
        const fieldLabel = CHANGE_OPTIONS.find((option) => option.answer === fieldToChange)!.label;
        return {
          status: "needs_input",
          title: fieldLabel,
          description: `${fieldLabel} de ${lead.name}: informe o dado novo.`,
          missingFields: [{ key: "newValue", label: fieldLabel.toLowerCase() }],
          appName: "Tracking",
          picker: NEW_VALUE_PICKERS[fieldToChange],
        };
      }
      if (fieldToChange === "amount") {
        const parsedAmount = parseAmount(input.newValue);
        if (parsedAmount === null) {
          return {
            status: "needs_input",
            title: "Valor inválido",
            description: `"${input.newValue}" não é um valor. Ex.: 5.000,00`,
            missingFields: [{ key: "newValue", label: "o valor" }],
            appName: "Tracking",
            picker: NEW_VALUE_PICKERS.amount,
          };
        }
        requested.amount = parsedAmount;
      } else {
        Object.assign(requested, { [fieldToChange]: input.newValue });
      }
    }

    const changes: Record<string, unknown> = {};
    const described: string[] = [];

    if (requested.phone) {
      changes.phone = requested.phone;
      described.push(`${FIELD_LABELS.phone} → ${requested.phone}`);
    }
    if (requested.email) {
      changes.email = requested.email;
      described.push(`${FIELD_LABELS.email} → ${requested.email}`);
    }
    if (requested.newName) {
      changes.name = requested.newName;
      described.push(`${FIELD_LABELS.newName} → ${requested.newName}`);
    }
    if (requested.description) {
      changes.description = requested.description;
      described.push(FIELD_LABELS.description);
    }
    if (requested.amount !== undefined) {
      changes.amount = new Decimal(requested.amount);
      described.push(
        `${FIELD_LABELS.amount} → ${requested.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      );
    }
    if (requested.temperature) {
      const temperature = normalizeTemperature(requested.temperature);
      if (!temperature) {
        return {
          status: "needs_input",
          title: "Temperatura não entendida",
          description: `Não sei o que é "${requested.temperature}". Frio, morno, quente ou muito quente?`,
          missingFields: [{ key: "temperature", label: "a temperatura" }],
          appName: "Tracking",
          picker: { kind: "select", options: TEMPERATURE_OPTIONS },
        };
      }
      changes.temperature = temperature;
      described.push(`${FIELD_LABELS.temperature} → ${requested.temperature}`);
    }

    // Editar nada não é editar: sem isso o Astro diria "pronto" sem ter feito.
    if (described.length === 0) {
      return {
        status: "needs_input",
        title: "O que mudar?",
        description: `Diga o que alterar em ${lead.name}: telefone, e-mail, nome, valor, temperatura ou descrição.`,
        missingFields: [{ key: "fieldToChange", label: "o que você quer mudar" }],
        appName: "Tracking",
        picker: { kind: "select", options: CHANGE_OPTIONS },
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Editar lead",
        description: `${lead.name}: ${described.join(", ")}.`,
        appName: "Tracking",
      };
    }

    await prisma.lead.update({ where: { id: lead.id }, data: changes });

    return {
      status: "done",
      title: "Lead atualizado",
      description: `${lead.name}: ${described.join(", ")}.`,
      internalUrl: `/contatos/${lead.id}`,
      openLabel: "Abrir lead",
      appName: "Tracking",
    };
  },
};
