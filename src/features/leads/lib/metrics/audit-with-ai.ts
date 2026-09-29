import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { resolvePrimaryModel } from "@/features/ia/lib/router";

// Último caso da auditoria (spec 0035, D-3): quando os dados não bastam, a IA
// lê a conversa e estima só potencial e interesse. Tempos e taxas nunca vêm dela.

const MESSAGES_FOR_AI = 30;

const aiAuditSchema = z.object({
  purchasePotential: z.number().int().min(0).max(100),
  interestLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  rationale: z.string().max(400),
});

export type AiLeadAudit = z.infer<typeof aiAuditSchema>;

const SYSTEM_PROMPT = `Você avalia leads de uma empresa a partir da conversa com a equipe de atendimento.
Estime o potencial de compra (0 a 100) e o nível de interesse (LOW, MEDIUM, HIGH) do CLIENTE.
Baseie-se só no que está escrito: intenção de compra, perguntas sobre preço, prazo ou condições, objeções, tom.
Sem sinais claros, prefira valores baixos. "rationale": uma frase curta em português explicando a nota.`;

export async function auditLeadWithAi(params: { organizationId: string; leadId: string }): Promise<AiLeadAudit | null> {
  const messages = await prisma.message.findMany({
    where: { conversation: { leadId: params.leadId } },
    select: { fromMe: true, body: true },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_FOR_AI,
  });
  const transcript = messages
    .reverse()
    .filter((message) => message.body?.trim())
    .map((message) => `${message.fromMe ? "ATENDENTE" : "CLIENTE"}: ${message.body!.slice(0, 500)}`)
    .join("\n");
  if (!transcript) return null;

  const resolved = await resolvePrimaryModel({
    organizationId: params.organizationId,
    tier: "FAST",
    requires: { json: true },
  });
  const { object } = await generateObject({
    model: resolved.model,
    schema: aiAuditSchema,
    system: SYSTEM_PROMPT,
    prompt: transcript,
  });
  return object;
}
