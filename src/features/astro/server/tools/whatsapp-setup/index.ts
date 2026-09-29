import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { canToggleInChatManual } from "@/features/tracking-chat/lib/can-toggle-in-chat-manual";
import {
  addNumberAndRequestCode,
  getSetupStatus,
  requestCode,
  verifyAndRegister,
} from "@/features/campanhas/server/lib/meta-setup-service";

// Astro conecta o WhatsApp oficial pelo chat (spec 0040, RF-13): mesmas
// funções do assistente em Campanhas, com a checagem de papel da tela.

const trackingField = z
  .string()
  .optional()
  .describe("ID do funil (tracking). Omita se a empresa só tem um funil com WhatsApp oficial.");

/** Funil do WhatsApp oficial: o informado, ou o único da org com chaves da Meta. */
async function resolveTrackingId(ctx: AgentContext, trackingId?: string): Promise<string | { error: string }> {
  if (trackingId) return trackingId;
  const instances = await prisma.whatsAppInstance.findMany({
    where: { organizationId: ctx.organizationId, provider: "META_CLOUD" },
    select: { trackingId: true, tracking: { select: { name: true } } },
    take: 5,
  });
  if (instances.length === 1 && instances[0].trackingId) return instances[0].trackingId;
  if (!instances.length) return { error: "Nenhum funil com WhatsApp oficial ainda. Peça para abrir Campanhas → Conectar número oficial." };
  return {
    error: `Mais de um funil com WhatsApp oficial: ${instances.map((instance) => `${instance.tracking?.name} (${instance.trackingId})`).join(", ")}. Pergunte qual.`,
  };
}

async function guardManager(ctx: AgentContext): Promise<{ error: string } | null> {
  return (await canToggleInChatManual(ctx.userId, ctx.organizationId))
    ? null
    : { error: "Só owner, admin ou moderador pode mexer no WhatsApp oficial." };
}

function toToolError(error: unknown) {
  return { error: error instanceof Error ? error.message : String(error) };
}

export function buildWhatsAppSetupReadTools(ctx: AgentContext): ToolSet {
  return {
    whatsapp_setup_status: tool({
      description:
        "Mostra o que falta para o WhatsApp oficial da empresa funcionar: chaves da Meta, conta, número conectado, qualidade e webhook.",
      inputSchema: z.object({ trackingId: trackingField }),
      execute: async ({ trackingId }) => {
        const resolved = await resolveTrackingId(ctx, trackingId);
        if (typeof resolved !== "string") return resolved;
        try {
          return await getSetupStatus({ organizationId: ctx.organizationId, trackingId: resolved });
        } catch (error) {
          return toToolError(error);
        }
      },
    }),
  };
}

export function buildWhatsAppSetupWriteTools(ctx: AgentContext): ToolSet {
  return {
    whatsapp_add_number: tool({
      description:
        "Cadastra um número novo na conta do WhatsApp oficial e pede o código por SMS. SÓ chame depois que o usuário confirmou o número e o nome de exibição.",
      inputSchema: z.object({
        trackingId: trackingField,
        phoneNumber: z.string().describe("Número com DDD, ex.: 11912345678"),
        verifiedName: z.string().describe("Nome que o cliente final vê (nome da empresa)"),
        isConfirmedByUser: z.literal(true).describe("true só depois do usuário confirmar explicitamente"),
      }),
      execute: async ({ trackingId, phoneNumber, verifiedName }) => {
        const denied = await guardManager(ctx);
        if (denied) return denied;
        const resolved = await resolveTrackingId(ctx, trackingId);
        if (typeof resolved !== "string") return resolved;
        try {
          return await addNumberAndRequestCode({ organizationId: ctx.organizationId, trackingId: resolved, phoneNumber, verifiedName });
        } catch (error) {
          return toToolError(error);
        }
      },
    }),
    whatsapp_request_code: tool({
      description: "Pede de novo o código de verificação de um número (SMS ou ligação).",
      inputSchema: z.object({
        trackingId: trackingField,
        phoneNumberId: z.string(),
        codeMethod: z.enum(["SMS", "VOICE"]).optional(),
      }),
      execute: async ({ trackingId, phoneNumberId, codeMethod }) => {
        const denied = await guardManager(ctx);
        if (denied) return denied;
        const resolved = await resolveTrackingId(ctx, trackingId);
        if (typeof resolved !== "string") return resolved;
        try {
          return await requestCode({ organizationId: ctx.organizationId, trackingId: resolved, phoneNumberId, codeMethod });
        } catch (error) {
          return toToolError(error);
        }
      },
    }),
    whatsapp_verify_code: tool({
      description: "Confirma o código de 6 dígitos que o usuário recebeu e registra o número na API oficial.",
      inputSchema: z.object({ trackingId: trackingField, phoneNumberId: z.string(), code: z.string() }),
      execute: async ({ trackingId, phoneNumberId, code }) => {
        const denied = await guardManager(ctx);
        if (denied) return denied;
        const resolved = await resolveTrackingId(ctx, trackingId);
        if (typeof resolved !== "string") return resolved;
        try {
          return await verifyAndRegister({ organizationId: ctx.organizationId, trackingId: resolved, phoneNumberId, code });
        } catch (error) {
          return toToolError(error);
        }
      },
    }),
  };
}
