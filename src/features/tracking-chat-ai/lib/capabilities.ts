import { z } from "zod";

// O que o Chatbot IA pode fazer pelo cliente (spec 0084). Guardado em
// `AiSettings.capabilities`; campo ausente = capacidade desligada.

/** 0,5 = 30 minutos antes (spec 0100, RF-14). */
const REMINDER_HOURS_OPTIONS = [0.5, 2, 24, 48] as const;
export const MIN_VOICE_CALL_MINUTES = 1;
export const MAX_VOICE_CALL_MINUTES = 10;

export const DEFAULT_HOLDING_TEXT = "Opa, {{primeiro_nome}}, já respondemos, só finalizando uns atendimentos aqui.";
export const DEFAULT_HANDOFF_TEXT = "{{primeiro_nome}}, assim que um dos nossos consultores desocupar, já te atende.";

/** Estado de atendimento por funil (spec 0113, RF-7): quem responde primeiro, tempos e textos fixos. */
/** Teto do "IA volta se o atendente sumir": quem agenda a checagem filtra por ele antes de ler a configuração. */
export const MAX_IN_SERVICE_AI_MINUTES = 120;

export const attendanceSettingsSchema = z.object({
  firstResponder: z.enum(["AI", "TEAM"]).catch("AI").default("AI"),
  holdingMinutes: z.number().int().min(1).max(30).catch(3).default(3),
  aiStepInMinutes: z.number().int().min(1).max(60).catch(5).default(5),
  inServiceAiMinutes: z.number().int().min(2).max(MAX_IN_SERVICE_AI_MINUTES).catch(10).default(10),
  ownerNoticeMinutes: z.number().int().min(5).max(120).catch(10).default(10),
  holdingText: z.string().trim().min(1).max(300).catch(DEFAULT_HOLDING_TEXT).default(DEFAULT_HOLDING_TEXT),
  handoffText: z.string().trim().min(1).max(300).catch(DEFAULT_HANDOFF_TEXT).default(DEFAULT_HANDOFF_TEXT),
});

export type AttendanceSettings = z.infer<typeof attendanceSettingsSchema>;

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
      hoursBefore: z.number().min(0.5).max(72).default(24),
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
  /** Atender chamadas de voz de clientes pelo WhatsApp (spec 0087, Parte C). */
  voiceCall: z.boolean().default(false),
  /** Duração máxima da chamada do cliente, em minutos (spec 0100, RF-5). Valor fora da faixa vale o padrão. */
  voiceCallMaxMinutes: z.number().int().min(MIN_VOICE_CALL_MINUTES).max(MAX_VOICE_CALL_MINUTES).catch(MAX_VOICE_CALL_MINUTES).default(MAX_VOICE_CALL_MINUTES),
  /** Atender por botões e listas o que é roteiro (marcar, ver, remarcar, cancelar), sem modelo (spec 0089). */
  guidedMenu: z.boolean().default(false),
  /** Cada resposta da assistente sai numa mensagem só, curta, em vez de 2 a 4 mensagens em sequência. */
  singleMessageReply: z.boolean().default(false),
  /** Documentos da Auto Inteligência que o atendimento pode ler (spec 0088). Vazio = nenhum. */
  knowledgeIds: z.array(z.string()).max(10).default([]),
  /** Membro que salvou a configuração: é quem assina demandas e lembretes criados pelo agente. Definido pelo servidor. */
  configuredByUserId: z.string().nullable().default(null),
  attendance: attendanceSettingsSchema.catch(attendanceSettingsSchema.parse({})).default(attendanceSettingsSchema.parse({})),
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
export const MAX_AGENT_REPLIES_PER_HOUR = 60;
