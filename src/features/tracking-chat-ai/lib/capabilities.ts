import { z } from "zod";

// O que o Chatbot IA pode fazer pelo cliente (spec 0084). Guardado em
// `AiSettings.capabilities`; campo ausente = capacidade desligada.

const REMINDER_HOURS_OPTIONS = [2, 24, 48] as const;

export const aiCapabilitiesSchema = z.object({
  understandAudio: z.boolean().default(false),
  /** Responde em nota de voz só quando o cliente manda áudio. */
  voiceReply: z.boolean().default(false),
  voiceName: z.string().max(40).nullable().default(null),
  agenda: z
    .object({
      isEnabled: z.boolean().default(false),
      agendaIds: z.array(z.string()).max(20).default([]),
    })
    .default({ isEnabled: false, agendaIds: [] }),
  /** Lembrete antes do horário, pelos lembretes do sistema (`Reminder`). */
  reminder: z
    .object({
      isEnabled: z.boolean().default(false),
      hoursBefore: z.number().int().min(1).max(72).default(24),
      /** Template aprovado na Meta, usado fora da janela de 24 h. Variáveis do corpo: {{1}} nome, {{2}} data e hora. */
      templateName: z.string().max(120).nullable().default(null),
    })
    .default({ isEnabled: false, hoursBefore: 24, templateName: null }),
  forms: z
    .object({
      isEnabled: z.boolean().default(false),
      formIds: z.array(z.string()).max(10).default([]),
    })
    .default({ isEnabled: false, formIds: [] }),
  /** Link das fichas do próprio cliente. */
  myRecordsLink: z.boolean().default(false),
  /** Links fixos da empresa (catálogo, site, cardápio). */
  links: z
    .object({
      isEnabled: z.boolean().default(false),
      items: z
        .array(z.object({ label: z.string().trim().min(1).max(40), url: z.string().trim().url().max(300) }))
        .max(5)
        .default([]),
    })
    .default({ isEnabled: false, items: [] }),
  receiveDocuments: z.boolean().default(false),
  /** PIX copia e cola de ficha finalizada do próprio cliente. */
  recordPix: z.boolean().default(false),
  /** O que o agente não resolve vira demanda no Workspace escolhido. */
  teamRequest: z
    .object({
      isEnabled: z.boolean().default(false),
      workspaceId: z.string().nullable().default(null),
    })
    .default({ isEnabled: false, workspaceId: null }),
  /** Membro que salvou a configuração: é quem assina demandas e lembretes criados pelo agente. Definido pelo servidor. */
  configuredByUserId: z.string().nullable().default(null),
});

export { REMINDER_HOURS_OPTIONS };

export type AiCapabilities = z.infer<typeof aiCapabilitiesSchema>;

export const DISABLED_AI_CAPABILITIES: AiCapabilities = aiCapabilitiesSchema.parse({});

/** Valor salvo inválido ou antigo nunca liga nada por acidente. */
export function parseAiCapabilities(raw: unknown): AiCapabilities {
  const parsed = aiCapabilitiesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DISABLED_AI_CAPABILITIES;
}

/** Áudio do cliente acima disto não é transcrito (RF-2). */
export const MAX_LEAD_AUDIO_SECONDS = 180;

/** Respostas do agente por cliente, por hora (RS-9). Acima disso, o atendimento passa para a equipe. */
export const MAX_AGENT_REPLIES_PER_HOUR = 30;
