import "server-only";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";

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
    .replace(/[̀-ͯ]/g, "");
  return TEMPERATURE_ALIASES[key] ?? null;
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

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Tracking",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    const changes: Record<string, unknown> = {};
    const described: string[] = [];

    if (input.phone) {
      changes.phone = input.phone;
      described.push(`${FIELD_LABELS.phone} → ${input.phone}`);
    }
    if (input.email) {
      changes.email = input.email;
      described.push(`${FIELD_LABELS.email} → ${input.email}`);
    }
    if (input.newName) {
      changes.name = input.newName;
      described.push(`${FIELD_LABELS.newName} → ${input.newName}`);
    }
    if (input.description) {
      changes.description = input.description;
      described.push(FIELD_LABELS.description);
    }
    if (input.amount !== undefined) {
      changes.amount = new Decimal(input.amount);
      described.push(
        `${FIELD_LABELS.amount} → ${input.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      );
    }
    if (input.temperature) {
      const temperature = normalizeTemperature(input.temperature);
      if (!temperature) {
        return {
          status: "needs_input",
          title: "Temperatura não entendida",
          description: `Não sei o que é "${input.temperature}". Frio, morno, quente ou muito quente?`,
          missingFields: [{ key: "temperature", label: "a temperatura" }],
          appName: "Tracking",
        };
      }
      changes.temperature = temperature;
      described.push(`${FIELD_LABELS.temperature} → ${input.temperature}`);
    }

    // Editar nada não é editar: sem isso o Astro diria "pronto" sem ter feito.
    if (described.length === 0) {
      return {
        status: "needs_input",
        title: "O que mudar?",
        description: `Diga o que alterar em ${lead.name}: telefone, e-mail, nome, valor, temperatura ou descrição.`,
        missingFields: [{ key: "phone", label: "o que você quer mudar" }],
        appName: "Tracking",
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
