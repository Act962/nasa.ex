import { z } from "zod";
import { AiAgentMode } from "@/generated/prisma/enums";

export const AGENT_KEYS = [
  "astro",
  "closer",
  "task-agent",
  "automation-agent",
  "analytics-agent",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

export const agentConfigInputSchema = z.object({
  agentKey: z.enum(AGENT_KEYS),
  enabled: z.boolean(),
  mode: z.nativeEnum(AiAgentMode),
  knowledgeIds: z.array(z.string()).default([]),
});

export type AgentConfigInput = z.infer<typeof agentConfigInputSchema>;
